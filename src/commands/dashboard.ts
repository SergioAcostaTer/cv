import { intro, outro, spinner } from "@clack/prompts";
import cors from "cors";
import express from "express";
import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import process from "node:process";
import open from "open";
import pc from "picocolors";
import { getRuntime } from "../core/runtime";
import { getDashboardHtml } from "../utils/dashboard-html";
import { runCliEntry } from "../utils/ui";

type DashboardFile = {
  filename: string;
  path: string;
  modifiedAt: number;
};

type LibraryResponse = {
  resumes: DashboardFile[];
  linkedinDrafts: DashboardFile[];
  roadmaps: DashboardFile[];
};

const isNotFound = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
};

const toPosixPath = (value: string): string => {
  return value.split(path.sep).join("/");
};

const walkFiles = async (baseDir: string): Promise<string[]> => {
  const results: string[] = [];

  const visit = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  };

  try {
    await visit(baseDir);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  return results;
};

const statFile = async (absolutePath: string): Promise<number> => {
  const stat = await fs.stat(absolutePath);
  return stat.mtimeMs;
};

const collectByExt = async (
  root: string,
  exts: string[],
  prefix = ""
): Promise<DashboardFile[]> => {
  const files = await walkFiles(root);
  const filtered = files.filter((file) => exts.includes(path.extname(file).toLowerCase()));

  const items = await Promise.all(
    filtered.map(async (absolutePath) => {
      const rel = toPosixPath(path.relative(root, absolutePath));
      const prefixed = prefix ? `${prefix}/${rel}` : rel;
      return {
        filename: path.basename(absolutePath),
        path: prefixed,
        modifiedAt: await statFile(absolutePath),
      };
    })
  );

  return items.sort((a, b) => b.modifiedAt - a.modifiedAt);
};

const safeJoinWithin = (root: string, relativePath: string): string | null => {
  const normalized = path.normalize(relativePath).replace(/^([./\\])+/, "");
  const candidate = path.resolve(root, normalized);
  const relativeToRoot = path.relative(root, candidate);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return candidate;
};

const parseApiPath = (value: string): { category: "linkedin" | "roadmaps"; relativePath: string } | null => {
  const [category, ...rest] = value.split("/");
  if (!category || rest.length === 0) {
    return null;
  }

  if (category !== "linkedin" && category !== "roadmaps") {
    return null;
  }

  const relativePath = rest.join("/");
  if (!relativePath) {
    return null;
  }

  return { category, relativePath };
};

const listenOnAvailablePort = async (app: express.Express, startPort: number): Promise<{ server: Server; port: number }> => {
  let port = startPort;

  while (true) {
    const attempt = await new Promise<{ server?: Server; conflict: boolean }>((resolve, reject) => {
      const server = createServer(app);
      server.once("error", (error) => {
        if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
          resolve({ conflict: true });
          return;
        }
        reject(error);
      });

      server.listen(port, () => {
        resolve({ server, conflict: false });
      });
    });

    if (attempt.server) {
      return { server: attempt.server, port };
    }

    port += 1;
  }
};

export const runDashboard = async (): Promise<void> => {
  intro(pc.bgBlue(pc.black(" CV Studio Dashboard ")));

  const runtime = getRuntime();
  const app = express();

  app.use(cors());

  app.get("/api/library", async (_req, res) => {
    try {
      const [resumes, linkedinDrafts, roadmaps] = await Promise.all([
        collectByExt(runtime.paths.distDir, [".pdf"]),
        collectByExt(path.join(runtime.paths.historyDir, "linkedin"), [".md", ".json"], "linkedin"),
        collectByExt(path.join(runtime.paths.historyDir, "roadmaps"), [".md"], "roadmaps"),
      ]);

      const payload: LibraryResponse = {
        resumes,
        linkedinDrafts,
        roadmaps,
      };

      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/file", async (req, res) => {
    const rawPath = String(req.query.path || "");
    const parsed = parseApiPath(rawPath);

    if (!parsed) {
      res.status(400).send("Invalid path.");
      return;
    }

    const baseRoot =
      parsed.category === "linkedin"
        ? path.join(runtime.paths.historyDir, "linkedin")
        : path.join(runtime.paths.historyDir, "roadmaps");

    const absolutePath = safeJoinWithin(baseRoot, parsed.relativePath);
    if (!absolutePath) {
      res.status(400).send("Path traversal denied.");
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    if (ext !== ".md" && ext !== ".json") {
      res.status(400).send("Unsupported file type.");
      return;
    }

    try {
      const content = await fs.readFile(absolutePath, "utf-8");
      res.type("text/plain; charset=utf-8").send(content);
    } catch (error) {
      if (isNotFound(error)) {
        res.status(404).send("File not found.");
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send(message);
    }
  });

  app.use("/pdfs", express.static(runtime.paths.distDir));

  app.get("/", (_req, res) => {
    res.type("text/html; charset=utf-8").send(getDashboardHtml());
  });

  const serverSpinner = spinner();
  serverSpinner.start("Starting local dashboard server...");

  const { server, port } = await listenOnAvailablePort(app, 3000);
  const url = `http://localhost:${port}`;
  serverSpinner.stop(`Dashboard running at ${pc.cyan(url)}`);

  await open(url);

  const closeServer = (): void => {
    server.close(() => {
      outro(`Dashboard server stopped (${pc.cyan(url)}).`);
      process.exit(0);
    });
  };

  process.once("SIGINT", closeServer);
  process.once("SIGTERM", closeServer);
};

export const run = async (): Promise<void> => {
  await runDashboard();
};

if (require.main === module) {
  runCliEntry(run);
}
