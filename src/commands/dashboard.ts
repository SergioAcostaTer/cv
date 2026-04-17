import { intro, outro, spinner } from "@clack/prompts";
import cors from "cors";
import express from "express";
import type { FSWatcher } from "node:fs";
import nodeFs, { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import process from "node:process";
import open from "open";
import pc from "picocolors";
import { getRuntime } from "../core/runtime";
import { createAIClient } from "../utils/api";
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

type SseClient = {
  id: number;
  res: express.Response;
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
  const sseClients = new Map<number, SseClient>();
  let nextClientId = 1;
  const watchers: FSWatcher[] = [];

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/library", async (_req, res) => {
    try {
      const [resumes, linkedinDrafts, roadmaps] = await Promise.all([
        collectByExt(runtime.paths.distDir, [".pdf"]),
        collectByExt(path.join(runtime.paths.historyDir, "linkedin"), [".json"], "linkedin"),
        collectByExt(path.join(runtime.paths.historyDir, "roadmaps"), [".json"], "roadmaps"),
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
    if (ext !== ".json") {
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

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const id = nextClientId;
    nextClientId += 1;

    sseClients.set(id, { id, res });
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    req.on("close", () => {
      sseClients.delete(id);
    });
  });

  app.post("/api/chat", async (req, res) => {
    const body = req.body as { messages?: Array<{ role: string; content: string }> };
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    const messages = incoming
      .filter((item) => item && typeof item.role === "string" && typeof item.content === "string")
      .map((item) => ({ role: item.role, content: item.content.trim() }))
      .filter((item) => item.content.length > 0);

    if (!messages.length) {
      res.status(400).json({ error: "messages must contain at least one role/content entry." });
      return;
    }

    try {
      const { client } = createAIClient({
        provider: "openai",
        model: "gpt-4o-mini"
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages.map((message) => {
          if (message.role === "system" || message.role === "assistant" || message.role === "user") {
            return {
              role: message.role,
              content: message.content
            };
          }

          return {
            role: "user" as const,
            content: message.content
          };
        }),
        stream: true
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          res.write(text);
        }
      }

      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.write(`\n\n[chat error] ${message}`);
        res.end();
      }
    }
  });

  const emitLibraryUpdated = (): void => {
    for (const client of sseClients.values()) {
      client.res.write(`event: library-updated\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }
  };

  const watchPath = (dirPath: string): void => {
    if (!nodeFs.existsSync(dirPath)) {
      return;
    }

    const watcher = nodeFs.watch(dirPath, { recursive: true }, () => {
      emitLibraryUpdated();
    });

    watchers.push(watcher);
  };

  watchPath(runtime.paths.distDir);
  watchPath(runtime.paths.historyDir);

  app.use("/pdfs", express.static(runtime.paths.distDir));
  app.use(express.static(path.join(runtime.paths.rootDir, "dist-client")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(runtime.paths.rootDir, "dist-client", "index.html"));
  });

  const serverSpinner = spinner();
  serverSpinner.start("Starting local dashboard server...");

  const { server, port } = await listenOnAvailablePort(app, 3000);
  const url = `http://localhost:${port}`;
  serverSpinner.stop(`Dashboard running at ${pc.cyan(url)}`);

  await open(url);

  const closeServer = (): void => {
    for (const watcher of watchers) {
      watcher.close();
    }

    for (const client of sseClients.values()) {
      client.res.end();
    }

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
