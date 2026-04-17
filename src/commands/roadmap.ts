import * as clack from '@clack/prompts';
import fs from 'fs';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import path from 'path';
import pc from 'picocolors';
import { getAppPaths } from '../core/runtime';
import { createAIClient, getModelsForProvider, type ProviderId } from '../utils/api';
import {
    branded,
    clearPrintedLines,
    clearScreen,
    colors,
    createSpinner,
    note,
    runCliEntry,
    secondary,
    success,
    unwrapCancel
} from '../utils/ui';

type CareerDriverId = 'salary' | 'leadership' | 'pivot' | 'balance';

type CareerDriverOption = {
  value: CareerDriverId;
  label: string;
};

const CAREER_DRIVERS: CareerDriverOption[] = [
  { value: 'salary', label: 'Maximize Salary (Individual Contributor)' },
  { value: 'leadership', label: 'Transition to Leadership/Management' },
  { value: 'pivot', label: 'Pivot to a New Tech Stack / Niche' },
  { value: 'balance', label: 'Optimize for Work-Life Balance / Remote' }
];

let markdownConfigured = false;

const configureMarkdownRenderer = (): void => {
  if (markdownConfigured) {
    return;
  }

  marked.setOptions({
    renderer: new TerminalRenderer({
      reflowText: true,
      tab: 2
    }) as unknown as import('marked').Renderer
  });

  markdownConfigured = true;
};

const findJsonFiles = (baseDir: string): string[] => {
  const files: string[] = [];

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === 'resume.json') {
        files.push(fullPath);
      }
    }
  };

  walk(baseDir);
  return files.sort((left, right) => left.localeCompare(right));
};

const chooseSourceJson = async (fallbackPath: string): Promise<string | null> => {
  const { profilesDir, exampleResumePath } = getAppPaths();
  const files = findJsonFiles(profilesDir);

  if (!files.length) {
    note(
      `No local resume JSON was found.\nCreate one at ${path.relative(process.cwd(), getAppPaths().defaultResumePath)}.\nReference example: ${path.relative(process.cwd(), exampleResumePath)}`,
      'Create JSON First'
    );
    return null;
  }

  const relativeFiles = files.map((filePath) => path.relative(process.cwd(), filePath));
  const result = await clack.select({
    message: 'Select source JSON',
    options: relativeFiles.map((filePath) => ({
      value: filePath,
      label: filePath
    })),
    initialValue: relativeFiles.includes(fallbackPath) ? fallbackPath : relativeFiles[0]
  });

  return unwrapCancel(result, 'Roadmap generation cancelled.');
};

const chooseCareerDriver = async (): Promise<CareerDriverOption> => {
  const value = await clack.select({
    message: 'Select your primary Career Driver',
    options: CAREER_DRIVERS
  });

  const selected = CAREER_DRIVERS.find((item) => item.value === unwrapCancel(value, 'Roadmap selection cancelled.'));
  return selected ?? CAREER_DRIVERS[0]!;
};

const chooseProvider = async (initialProvider: ProviderId): Promise<ProviderId> => {
  const result = await clack.select({
    message: 'Choose an AI provider',
    options: [
      { value: 'openai', label: 'OpenAI' },
      { value: 'deepseek', label: 'DeepSeek' }
    ],
    initialValue: initialProvider
  });

  return unwrapCancel(result, 'Roadmap generation cancelled before provider selection.');
};

const chooseModel = async (provider: ProviderId): Promise<string> => {
  const models = getModelsForProvider(provider);
  const result = await clack.select({
    message: 'Choose a strategy model',
    options: models.map((item) => ({
      value: item.id,
      label: item.label,
      hint: secondary(item.note)
    })),
    initialValue: models[0]?.id
  });

  return unwrapCancel(result, 'Roadmap generation cancelled before model selection.');
};

const buildSystemPrompt = (): string => `You are a top-tier global tech recruiter and principal engineering career coach.

You must produce a strategic, realistic, market-aware career roadmap based only on the user's resume data and career driver.

Output requirements:
- Output ONLY valid Markdown.
- Be specific and practical.
- Do not fabricate company names, certifications, or achievements not grounded in the source profile.
- If a detail is uncertain, state assumptions clearly.

The markdown must include exactly these sections and order:

# AI Career Roadmap

## Current Market Evaluation
- Evaluate where this profile stands today in the current market.
- Highlight strengths, risks, and competitiveness.

## Target Roles & Salary Projections
- Provide 2-3 concrete target roles for the next move.
- For each role include:
  - Why it fits this profile.
  - Realistic salary range (yearly, currency + region assumptions).
  - Seniority expectation.

## The Gap Analysis
- List specific missing skills, certifications, portfolio projects, and positioning upgrades required to reach the target roles.
- Separate "Critical Gaps" from "Nice-to-Have" items.

## 12-Month Action Plan
- Provide a month-by-month actionable roadmap in bullet points.
- Include interview prep, networking, branding (CV/LinkedIn), and execution milestones.

Close with a short "Execution Priority" checklist of top 5 actions.`;

const buildUserPrompt = (input: { careerDriver: string; sourcePath: string; resumeJson: string }): string =>
  [
    `Career Driver: ${input.careerDriver}`,
    `Source File: ${input.sourcePath}`,
    'Resume JSON:',
    '```json',
    input.resumeJson,
    '```'
  ].join('\n\n');

const streamRoadmap = async (input: {
  provider: ProviderId;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> => {
  const { client } = createAIClient({
    provider: input.provider,
    model: input.model
  });

  const spinner = createSpinner();
  spinner.start(`Generating roadmap with ${input.provider} (${input.model})`);

  const stream = await client.chat.completions.create({
    model: input.model,
    stream: true,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt }
    ]
  });

  let response = '';
  let previewText = '';
  let outputStarted = false;

  const startOutput = (): void => {
    if (outputStarted) {
      return;
    }

    outputStarted = true;
    spinner.stop('Roadmap stream started');
    process.stdout.write(`\n${branded('Roadmap (streaming preview):')}\n`);
  };

  const writePreview = (value: string): void => {
    if (!value) {
      return;
    }

    previewText += value;
    process.stdout.write(colors.muted(value));
  };

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta as { content?: string; reasoning_content?: string } | undefined;
    const reasoningContent = delta?.reasoning_content;
    if (reasoningContent) {
      startOutput();
      writePreview(reasoningContent);
    }

    const content = delta?.content;
    if (!content) {
      continue;
    }

    startOutput();
    response += content;
    writePreview(content);
  }

  if (!outputStarted) {
    spinner.stop('Roadmap response was empty');
    return '';
  }

  const previewLines = previewText.split(/\r?\n/u).length + 1;
  process.stdout.write('\n');
  clearPrintedLines(previewLines);

  process.stdout.write(`${branded('Career Roadmap:')}\n`);
  const rendered = marked.parse(response);
  const output = typeof rendered === 'string' ? rendered : await rendered;
  process.stdout.write(`${output}${output.endsWith('\n') ? '' : '\n'}\n`);

  return response;
};

const maybeSaveRoadmap = async (roadmapMarkdown: string): Promise<void> => {
  if (!roadmapMarkdown.trim()) {
    return;
  }

  const confirm = await clack.confirm({
    message: 'Would you like to save this roadmap as a markdown file?'
  });

  const shouldSave = unwrapCancel(confirm, 'Roadmap save cancelled.');
  if (!shouldSave) {
    return;
  }

  const date = new Date().toISOString().split('T')[0] ?? 'today';
  const outputPath = path.join(getAppPaths().profilesDir, `career-roadmap-${date}.md`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, roadmapMarkdown, 'utf8');
  success(`Roadmap saved: ${path.relative(process.cwd(), outputPath)}`);
};

export const run = async (): Promise<void> => {
  configureMarkdownRenderer();
  clearScreen();
  clack.intro(`${pc.bold(colors.primary('Career Strategist'))} ${secondary('AI roadmap coach')}`);

  const { defaultResumePath } = getAppPaths();
  const sourcePath = await chooseSourceJson(path.relative(process.cwd(), defaultResumePath));
  if (!sourcePath) {
    return;
  }

  const careerDriver = await chooseCareerDriver();
  const provider = await chooseProvider('openai');
  const model = await chooseModel(provider);

  const rawResume = fs.readFileSync(path.resolve(sourcePath), 'utf8');
  const parsedResume = JSON.parse(rawResume) as unknown;
  const resumeJson = JSON.stringify(parsedResume, null, 2);

  const roadmapMarkdown = await streamRoadmap({
    provider,
    model,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt({
      careerDriver: careerDriver.label,
      sourcePath,
      resumeJson
    })
  });

  await maybeSaveRoadmap(roadmapMarkdown);
};

if (require.main === module) {
  runCliEntry(run);
}