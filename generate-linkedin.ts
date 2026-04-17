#!/usr/bin/env node

import { prompt } from 'enquirer';
import fs from 'fs';
import path from 'path';
import { generateLinkedinProfiles, generateStrategyOptions } from './lib/linkedin-generator';

type PromptChoice = { name: string; message: string };

type OptionItem = {
  label: string;
  value: string;
  reason?: string;
  score?: number;
};

const OPENAI_MODELS = [
  { id: 'gpt-5', label: 'GPT-5', cost: 'Est. $5.00 input / $15.00 output per 1M tokens', inputPer1M: 5.0, outputPer1M: 15.0, note: 'Highest quality' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini', cost: 'Est. $1.00 input / $3.00 output per 1M tokens', inputPer1M: 1.0, outputPer1M: 3.0, note: 'Best quality/cost balance' },
  { id: 'gpt-5-nano', label: 'GPT-5 Nano', cost: 'Est. $0.20 input / $0.80 output per 1M tokens', inputPer1M: 0.2, outputPer1M: 0.8, note: 'Lowest cost' },
  { id: 'gpt-4.1', label: 'GPT-4.1', cost: 'Est. $2.00 input / $8.00 output per 1M tokens', inputPer1M: 2.0, outputPer1M: 8.0, note: 'Strong fallback' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', cost: 'Est. $0.40 input / $1.60 output per 1M tokens', inputPer1M: 0.4, outputPer1M: 1.6, note: 'Fast and affordable' },
  { id: 'custom', label: 'Custom model name', cost: 'User-provided', note: 'Type any OpenAI model id' }
];

const OPENAI_MODEL_CATALOG = OPENAI_MODELS.map((item) => ({
  id: item.id,
  label: item.label,
  cost: item.cost,
  note: item.note
}));

const UI = { width: 132, listLimit: 12 };

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

const color = (text: string, style: string): string => `${style}${text}${ANSI.reset}`;

const clearScreen = (): void => {
  process.stdout.write('\x1Bc');
};

const clampText = (text: unknown, max = UI.width): string => {
  const value = String(text || '');
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
};

const header = (title: string, subtitle?: string): void => {
  const line = '─'.repeat(UI.width);
  console.log(color(line, ANSI.dim));
  console.log(color(clampText(title), ANSI.bold + ANSI.cyan));
  if (subtitle) {
    console.log(color(clampText(subtitle), ANSI.dim));
  }
  console.log(color(line, ANSI.dim));
};

const status = (msg: string): void => {
  console.log(color(`\n${clampText(msg)}`, ANSI.yellow));
};

const parseArgs = (argv: string[]): Record<string, any> => {
  const args: Record<string, any> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;

    if (value !== true) {
      i += 1;
    }
  }

  return args;
};

const loadDotEnv = (envPath = '.env'): void => {
  const absolutePath = path.resolve(envPath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const envContent = fs.readFileSync(absolutePath, 'utf8');
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"|"$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const printHelp = (): void => {
  console.log([
    'AI LinkedIn generator (interactive Codex-style TUI)',
    '',
    'Usage:',
    '  pnpm linkedin',
    '  pnpm tsx generate-linkedin.ts',
    '',
    'Flags:',
    '  --provider openai  (optional, openai only)',
    '  --input src/backend/en/resume.json',
    '  --resume src/backend/en/resume.json  (legacy alias)',
    '  --languages en,es',
    '  --output dist/linkedin.json',
    '  --model <model>',
    '  --api-key <key>',
    '  --base-url <url>   (optional OpenAI-compatible base URL)',
    '',
    'Env vars:',
    '  OPENAI_API_KEY, AI_API_KEY'
  ].join('\n'));
};

const findJsonFiles = (baseDir: string): string[] => {
  const files: string[] = [];

  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  };

  walk(baseDir);
  return files.sort((a, b) => a.localeCompare(b));
};

const toChoice = (label: string, value: string, reason?: string, score?: number): PromptChoice => {
  const scorePrefix = Number.isFinite(score as number) ? `[${Math.max(0, Math.min(100, Math.round(Number(score))))}/100] ` : '';
  const shortReason = reason ? ` - ${clampText(reason, 78)}` : '';
  return {
    name: value,
    message: clampText(`${scorePrefix}${label}${shortReason}`, UI.width)
  };
};

const askSelect = async (message: string, choices: PromptChoice[], initialName?: string): Promise<string> => {
  if (!choices.length) {
    throw new Error(`No choices available for: ${message}`);
  }

  const initialIndex = Math.max(0, choices.findIndex((choice) => choice.name === initialName));

  const result = await prompt<{ value: string }>({
    type: 'select',
    name: 'value',
    message,
    choices,
    initial: initialIndex,
    limit: UI.listLimit
  });

  return result.value;
};

const askAutocomplete = async (message: string, choices: PromptChoice[], initialName?: string): Promise<string> => {
  const initialIndex = Math.max(0, choices.findIndex((choice) => choice.name === initialName));

  const result = await prompt<{ value: string }>({
    type: 'autocomplete',
    name: 'value',
    message,
    choices,
    initial: initialIndex,
    limit: UI.listLimit
  });

  return result.value;
};

const askInput = async (message: string, initial = ''): Promise<string> => {
  const result = await prompt<{ value: string }>({
    type: 'input',
    name: 'value',
    message,
    initial
  });
  return String(result.value || '').trim() || initial;
};

const estimateCharsToTokens = (chars: number): number => Math.max(1, Math.ceil(Number(chars || 0) / 4));

const fmtUsd = (value: number): string => {
  const num = Number(value || 0);
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.1) return `$${num.toFixed(3)}`;
  return `$${num.toFixed(4)}`;
};

const estimateWholeProcessCost = ({ modelId, sourcePath, languageCount }: { modelId: string; sourcePath: string; languageCount: number }) => {
  const modelPricing = OPENAI_MODELS.find((model) => model.id === modelId);
  if (!modelPricing || !modelPricing.inputPer1M || !modelPricing.outputPer1M) {
    return { available: false, reason: 'No pricing data for selected model' };
  }

  const resolvedPath = path.resolve(sourcePath);
  let sourceChars = 0;
  try {
    sourceChars = fs.readFileSync(resolvedPath, 'utf8').length;
  } catch (_error) {
    sourceChars = 8000;
  }

  const srcTokens = estimateCharsToTokens(sourceChars);
  const strategyInput = srcTokens + 1400;
  const strategyOutput = 1400;
  const perLangInput = srcTokens + 2200;
  const perLangOutput = 3200;

  const count = Math.max(1, Number(languageCount || 1));
  const totalInputTokens = strategyInput + perLangInput * count;
  const totalOutputTokens = strategyOutput + perLangOutput * count;

  const inputCost = (totalInputTokens / 1_000_000) * modelPricing.inputPer1M;
  const outputCost = (totalOutputTokens / 1_000_000) * modelPricing.outputPer1M;
  const totalCost = inputCost + outputCost;

  return {
    available: true,
    sourceChars,
    sourceTokens: srcTokens,
    totalInputTokens,
    totalOutputTokens,
    inputCost,
    outputCost,
    totalCost
  };
};

const normalizeOptions = (items: any[], withValue = false): OptionItem[] => {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safe.length) {
    throw new Error('AI returned an empty options list.');
  }

  return safe.map((item) => ({
    label: item.label,
    value: withValue ? item.value || item.label : item.label,
    reason: item.reason || '',
    score: Number.isFinite(item.score) ? item.score : 50
  }));
};

const pickRecommended = (options: OptionItem[], recommendedValue?: string): string | undefined => {
  if (!options.length) return undefined;
  if (!recommendedValue) return options[0].value;

  const needle = String(recommendedValue).toLowerCase();
  const exact = options.find((opt) => String(opt.value).toLowerCase() === needle);
  if (exact) return exact.value;

  const fuzzy = options.find((opt) => String(opt.label).toLowerCase().includes(needle));
  if (fuzzy) return fuzzy.value;

  const sorted = [...options].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return sorted[0]?.value || options[0].value;
};

const modelSelector = async ({
  sourcePath,
  languageCount,
  aiModelOptions,
  fallbackModel
}: {
  sourcePath: string;
  languageCount: number;
  aiModelOptions: OptionItem[];
  fallbackModel: string;
}): Promise<string> => {
  const choices = aiModelOptions.map((aiModel) => {
    const staticModel = OPENAI_MODELS.find((model) => model.id === aiModel.value);

    if (aiModel.value === 'custom') {
      return toChoice(aiModel.label, aiModel.value, `${aiModel.reason || 'AI suggested'}. User-provided pricing`, aiModel.score);
    }

    if (!staticModel) {
      return toChoice(aiModel.label, aiModel.value, `${aiModel.reason || 'AI suggested'}. Estimated total: n/a`, aiModel.score);
    }

    const estimate = estimateWholeProcessCost({ modelId: staticModel.id, sourcePath, languageCount });
    const costText = estimate.available ? `Estimated total: ${fmtUsd((estimate as any).totalCost)}` : 'Estimated total: n/a';
    return toChoice(aiModel.label, aiModel.value, `${costText}. ${aiModel.reason || staticModel.note}`, aiModel.score);
  });

  return askSelect('Select OpenAI model (AI-ranked + estimated total cost)', choices, fallbackModel || 'gpt-5-mini');
};

const inputFileSelector = async (fallbackPath: string): Promise<string> => {
  const srcDir = path.join(process.cwd(), 'src');
  const root = fs.existsSync(srcDir) ? srcDir : process.cwd();
  const files = findJsonFiles(root);

  if (!files.length) {
    return fallbackPath || 'src/backend/en/resume.json';
  }

  const relativeFiles = files.map((filePath) => path.relative(process.cwd(), filePath));
  const choices = relativeFiles.map((rel) => toChoice(rel, rel, 'JSON profile source'));
  return askAutocomplete('Select source JSON', choices, fallbackPath || relativeFiles[0]);
};

const chooseAIOption = async (title: string, items: OptionItem[], recommended?: string): Promise<string> => {
  const rec = pickRecommended(items, recommended);
  return askSelect(
    title,
    items
      .slice()
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .map((item) => toChoice(item.label, item.value, item.reason, item.score)),
    rec
  );
};

const run = async (): Promise<void> => {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printHelp();
    return;
  }

  clearScreen();
  header('LinkedIn JSON Generator', 'OpenAI-only, arrow-key selector UI with AI-generated strategy options');

  if (args.provider && String(args.provider).toLowerCase() !== 'openai') {
    throw new Error('Only OpenAI is supported. Remove --provider or set --provider openai.');
  }

  const provider = 'openai';
  const inputPath = await inputFileSelector(args.input || args.resume || 'src/backend/en/resume.json');

  const preselectedLanguages = String(args.languages || 'en,es')
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  const bootstrapModel = args.model || 'gpt-5-mini';

  const providerOptions: Record<string, any> = {
    model: bootstrapModel,
    apiKey: args['api-key'],
    baseUrl: args['base-url']
  };

  status('Generating intelligent option sets from selected JSON...');

  const strategy = await generateStrategyOptions({
    inputPath,
    provider,
    providerOptions,
    availableModels: OPENAI_MODEL_CATALOG
  });

  clearScreen();
  header('Strategy Generated', strategy.options.analysisSummary || 'No analysis summary returned by model.');
  console.log(color(`Provider: ${strategy.providerConfig.label} (${strategy.providerConfig.model})`, ANSI.dim));
  console.log(color(`Fallback mode: ${strategy.fallbackUsed ? 'yes' : 'no'}`, ANSI.dim));
  if (strategy.fallbackUsed && strategy.fallbackReason) {
    console.log(color(`Fallback reason: ${clampText(strategy.fallbackReason, UI.width)}`, ANSI.dim));
  }

  const options = strategy.options.options || {};
  const recommended = strategy.options.recommended || {};

  const goals = normalizeOptions(options.goals);
  const positionings = normalizeOptions(options.positioningAngles);
  const markets = normalizeOptions(options.targetMarkets);
  const seniorities = normalizeOptions(options.seniorityTracks);
  const languagePlans = normalizeOptions(options.languagePlans, true);
  const modelOptions = normalizeOptions(options.modelOptions, true);
  const constraintsProfiles = normalizeOptions(options.constraintsProfiles);

  const keywordClusters = Array.isArray(options.keywordClusters) && options.keywordClusters.length
    ? options.keywordClusters
    : (() => { throw new Error('AI strategy response missing options.keywordClusters'); })();

  const keywordClusterOptions: OptionItem[] = keywordClusters.map((cluster: any) => ({
    label: cluster.label,
    value: cluster.label,
    reason: cluster.reason || '',
    score: Number.isFinite(cluster.score) ? cluster.score : 50
  }));

  const selectedModel = await modelSelector({
    fallbackModel: bootstrapModel,
    sourcePath: inputPath,
    languageCount: preselectedLanguages.length || 2,
    aiModelOptions: modelOptions
  });

  providerOptions.model = selectedModel;

  if (selectedModel === 'custom') {
    providerOptions.model = await askInput('Custom OpenAI model id', 'gpt-5-mini');
  }

  const optimizationGoal = await chooseAIOption('Select optimization goal', goals, recommended.goal);
  const preferredPath = await chooseAIOption('Select positioning angle', positionings, recommended.positioning);
  const targetMarket = await chooseAIOption('Select target market', markets, recommended.market);
  const targetSeniority = await chooseAIOption('Select seniority track', seniorities, recommended.seniority);
  const constraints = await chooseAIOption('Select writing constraints', constraintsProfiles, recommended.constraintsProfile);

  const selectedKeywordClusterName = await chooseAIOption('Select keyword cluster', keywordClusterOptions, recommended.keywordCluster);
  const selectedKeywordCluster = keywordClusters.find((item: any) => item.label === selectedKeywordClusterName);
  const roleKeywords = (selectedKeywordCluster?.keywords || []).join(', ');

  const languageSelection = await chooseAIOption('Select language plan', languagePlans, recommended.languagePlan || args.languages || 'en,es');

  const languagesInput = languageSelection === 'custom'
    ? await askInput('Language codes (comma separated)', args.languages || 'en,es')
    : languageSelection;

  const roleFocus = await askInput('Role focus for the prompt', preferredPath);
  const outputPath = await askInput('Output file path', args.output || 'dist/linkedin.json');

  const languages = String(languagesInput)
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  const answers = {
    optimizationGoal,
    roleFocus,
    targetSeniority,
    targetMarket,
    roleKeywords: roleKeywords
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean),
    constraints,
    preferredPath,
    cvInsights: {
      analysisSummary: strategy.options.analysisSummary || '',
      fallbackUsed: strategy.fallbackUsed,
      selector: {
        sourcePath: inputPath,
        selectedKeywordCluster: selectedKeywordClusterName
      }
    }
  };

  const costEstimate = estimateWholeProcessCost({ modelId: providerOptions.model, sourcePath: inputPath, languageCount: languages.length });

  if ((costEstimate as any).available) {
    console.log('');
    header('Estimated Cost (whole process)', 'Strategy + all language generation calls');
    console.log(color(`Model: ${providerOptions.model}`, ANSI.dim));
    console.log(color(`Estimated tokens in/out: ${(costEstimate as any).totalInputTokens} / ${(costEstimate as any).totalOutputTokens}`, ANSI.dim));
    console.log(color(`Estimated cost in/out: ${fmtUsd((costEstimate as any).inputCost)} / ${fmtUsd((costEstimate as any).outputCost)}`, ANSI.dim));
    console.log(color(`Estimated total cost: ${fmtUsd((costEstimate as any).totalCost)}`, ANSI.green));
  } else {
    console.log(color(`\nEstimated total cost unavailable: ${(costEstimate as any).reason}`, ANSI.yellow));
  }

  status('Generating linkedin.json...');

  const { outputPath: generatedPath, providerConfig } = await generateLinkedinProfiles({
    sourcePath: inputPath,
    provider,
    providerOptions,
    languages,
    answers,
    outputPath
  });

  clearScreen();
  header('Done', 'LinkedIn profile JSON generated successfully');
  console.log(color(`Provider: ${providerConfig.label}`, ANSI.green));
  console.log(color(`Model: ${providerConfig.model}`, ANSI.green));
  console.log(color(`Input: ${inputPath}`, ANSI.green));
  console.log(color(`Output: ${generatedPath}\n`, ANSI.green));
};

run().catch((error: any) => {
  console.error(color(`Error: ${error.message}`, ANSI.yellow));
  process.exit(1);
});
