import * as clack from '@clack/prompts';
import fs from 'fs';
import path from 'path';
import { getAppPaths } from '../core/runtime';
import { getModelsForProvider, type ClientConfig, type ModelCatalogItem, type ProviderId } from '../utils/api';
import { writeLinkedinHtmlReport } from '../utils/html-export';
import {
    generateLinkedinProfiles,
    generateStrategyOptions,
    getProviderModelCatalog,
    type GeneratorAnswers
} from '../utils/linkedin-generator';
import { note, runCliEntry, secondary, success, unwrapCancel } from '../utils/ui';

type OptionItem = {
  label: string;
  value: string;
  reason: string;
  score: number;
};

type GroupedSelections = {
  model: string;
  optimizationGoal: string;
  preferredPath: string;
  targetMarket: string;
  targetSeniority: string;
  constraints: string;
  selectedKeywordClusterName: string;
};

type CliArgs = Record<string, string | boolean>;

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];
    const value = nextValue && !nextValue.startsWith('--') ? nextValue : true;
    args[key] = value;

    if (value !== true) {
      index += 1;
    }
  }

  return args;
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

const estimateCharsToTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 4));

const fmtUsd = (value: number): string => {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
};

const estimateWholeProcessCost = (input: {
  modelId: string;
  sourcePath: string;
  languageCount: number;
  catalog: ModelCatalogItem[];
}): { available: true; totalInputTokens: number; totalOutputTokens: number; inputCost: number; outputCost: number; totalCost: number } | { available: false; reason: string } => {
  const modelPricing = input.catalog.find((model) => model.id === input.modelId);
  if (!modelPricing?.inputPer1M || !modelPricing.outputPer1M) {
    return { available: false, reason: 'No pricing data for selected model' };
  }

  let sourceChars = 8000;
  try {
    sourceChars = fs.readFileSync(path.resolve(input.sourcePath), 'utf8').length;
  } catch {
    sourceChars = 8000;
  }

  const srcTokens = estimateCharsToTokens(sourceChars);
  const strategyInput = srcTokens + 1400;
  const strategyOutput = 1400;
  const perLangInput = srcTokens + 2200;
  const perLangOutput = 3200;
  const count = Math.max(1, input.languageCount);
  const totalInputTokens = strategyInput + perLangInput * count;
  const totalOutputTokens = strategyOutput + perLangOutput * count;
  const inputCost = (totalInputTokens / 1_000_000) * modelPricing.inputPer1M;
  const outputCost = (totalOutputTokens / 1_000_000) * modelPricing.outputPer1M;

  return {
    available: true,
    totalInputTokens,
    totalOutputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
};

const normalizeOptions = (
  items: Array<{ label: string; value?: string; reason?: string; score?: number }>
): OptionItem[] =>
  items.map((item) => ({
    label: item.label,
    value: item.value ?? item.label,
    reason: item.reason ?? '',
    score: Number.isFinite(item.score) ? Number(item.score) : 50
  }));

const pickRecommended = (options: OptionItem[], recommendedValue?: string): string | undefined => {
  if (!options.length) {
    return undefined;
  }

  if (!recommendedValue) {
    return options[0]?.value;
  }

  return options.find((item) => item.value.toLowerCase() === recommendedValue.toLowerCase())?.value ?? options[0]?.value;
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

  return unwrapCancel(result, 'LinkedIn generation cancelled.');
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

  return unwrapCancel(result, 'LinkedIn generation cancelled before provider selection.');
};

const chooseModel = async (provider: ProviderId, initialModel?: string): Promise<string> => {
  const models = getModelsForProvider(provider);
  const result = await clack.select({
    message: 'Choose a model',
    options: models.map((item) => ({
      value: item.id,
      label: item.label,
      hint: secondary(item.note)
    })),
    initialValue: initialModel && models.some((item) => item.id === initialModel) ? initialModel : models[0]?.id
  });

  return unwrapCancel(result, 'LinkedIn generation cancelled before model selection.');
};

const chooseAIOption = async (title: string, items: OptionItem[], recommended?: string): Promise<string> => {
  const initialValue = pickRecommended(items, recommended);
  const result = await clack.select({
    message: title,
    options: items
      .slice()
      .sort((left, right) => right.score - left.score)
      .map((item) => ({
        value: item.value,
        label: item.label,
        hint: secondary(`${item.score}/100 ${item.reason}`)
      })),
    initialValue
  });

  return unwrapCancel(result, `Selection cancelled: ${title}`);
};

const askText = async (message: string, initialValue: string): Promise<string> => {
  const result = await clack.text({
    message,
    defaultValue: initialValue
  });

  return unwrapCancel(result, `Input cancelled: ${message}`).trim() || initialValue;
};

const chooseLanguages = async (defaultLanguages: string): Promise<string> => {
  const normalizedDefault = defaultLanguages.trim() || 'en,es';
  const presetOptions = ['en,es', 'en', 'es'];
  const initialValue = presetOptions.includes(normalizedDefault) ? normalizedDefault : 'custom';

  const selection = await clack.select({
    message: 'Select output languages for the LinkedIn profile',
    options: [
      { value: 'en,es', label: 'English + Spanish (default)' },
      { value: 'en', label: 'English only' },
      { value: 'es', label: 'Spanish only' },
      { value: 'custom', label: 'Custom (comma-separated)' }
    ],
    initialValue
  });

  const selected = unwrapCancel(selection, 'Language selection cancelled.');
  if (selected === 'custom') {
    return askText('Language codes (comma-separated)', normalizedDefault);
  }

  return selected;
};

export const run = async (providedArgs?: string[]): Promise<void> => {
  const args = parseArgs(providedArgs ?? process.argv.slice(2));
  const { defaultResumePath, linkedinOutputPath } = getAppPaths();

  if (args['from-json']) {
    const inputJsonPath =
      typeof args['from-json'] === 'string' ? path.resolve(args['from-json']) : path.resolve(linkedinOutputPath);
    const raw = fs.readFileSync(inputJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as Awaited<ReturnType<typeof generateLinkedinProfiles>>['result'];
    const htmlPath = writeLinkedinHtmlReport({ result: parsed, jsonPath: inputJsonPath });
    success(`LinkedIn HTML generated from JSON: ${path.relative(process.cwd(), htmlPath)}`);
    return;
  }

  const sourcePath = await chooseSourceJson(path.relative(process.cwd(), defaultResumePath));
  if (!sourcePath) {
    return;
  }

  const initialProvider = String(args.provider || 'openai').toLowerCase() === 'deepseek' ? 'deepseek' : 'openai';
  const provider = await chooseProvider(initialProvider);
  const bootstrapModel = await chooseModel(provider, typeof args.model === 'string' ? args.model : undefined);
  const preselectedLanguages = String(args.languages || 'en,es')
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  const providerOptions: ClientConfig = {
    provider,
    model: bootstrapModel,
    apiKey: typeof args['api-key'] === 'string' ? args['api-key'] : undefined,
    baseUrl: typeof args['base-url'] === 'string' ? args['base-url'] : undefined
  };

  const strategySpinner = clack.spinner();
  strategySpinner.start(`Generating strategy options with ${provider} (${bootstrapModel})`);

  const strategy = await generateStrategyOptions({
    inputPath: sourcePath,
    provider,
    providerOptions,
    availableModels: getProviderModelCatalog(provider)
  });

  strategySpinner.stop('Strategy options ready');
  note(strategy.options.analysisSummary, 'Strategy');

  const options = strategy.options.options;
  const recommended = strategy.options.recommended;
  const goals = normalizeOptions(options.goals);
  const positionings = normalizeOptions(options.positioningAngles);
  const markets = normalizeOptions(options.targetMarkets);
  const seniorities = normalizeOptions(options.seniorityTracks);
  const modelOptions = normalizeOptions(options.modelOptions);
  const constraintsProfiles = normalizeOptions(options.constraintsProfiles);
  const keywordClusters = options.keywordClusters.map((cluster) => ({
    label: cluster.label,
    value: cluster.label,
    reason: cluster.reason,
    score: cluster.score
  }));

  const groupedSelections = await clack.group<GroupedSelections>({
    model: () => chooseAIOption('Select model', modelOptions, bootstrapModel),
    optimizationGoal: () => chooseAIOption('Select optimization goal', goals, recommended.goal),
    preferredPath: () => chooseAIOption('Select positioning angle', positionings, recommended.positioning),
    targetMarket: () => chooseAIOption('Select target market', markets, recommended.market),
    targetSeniority: () => chooseAIOption('Select seniority track', seniorities, recommended.seniority),
    constraints: () => chooseAIOption('Select writing constraints', constraintsProfiles, recommended.constraintsProfile),
    selectedKeywordClusterName: () => chooseAIOption('Select keyword cluster', keywordClusters, recommended.keywordCluster)
  });

  providerOptions.model = groupedSelections.model;
  const optimizationGoal = groupedSelections.optimizationGoal;
  const preferredPath = groupedSelections.preferredPath;
  const targetMarket = groupedSelections.targetMarket;
  const targetSeniority = groupedSelections.targetSeniority;
  const constraints = groupedSelections.constraints;
  const selectedKeywordClusterName = groupedSelections.selectedKeywordClusterName;
  const selectedKeywordCluster = options.keywordClusters.find((cluster) => cluster.label === selectedKeywordClusterName);
  const languagesInput = await chooseLanguages(preselectedLanguages.join(',') || 'en,es');
  const roleFocus = await askText('Role focus for the prompt', preferredPath);
  const outputPath = await askText('Output file path', path.relative(process.cwd(), linkedinOutputPath));

  const languages = languagesInput
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  const answers: GeneratorAnswers = {
    optimizationGoal,
    roleFocus,
    targetSeniority,
    targetMarket,
    roleKeywords: selectedKeywordCluster?.keywords ?? [],
    constraints,
    preferredPath,
    cvInsights: {
      analysisSummary: strategy.options.analysisSummary,
      selector: {
        sourcePath,
        selectedKeywordCluster: selectedKeywordClusterName
      }
    }
  };

  const estimate = estimateWholeProcessCost({
    modelId: providerOptions.model,
    sourcePath,
    languageCount: languages.length || preselectedLanguages.length || 1,
    catalog: getProviderModelCatalog(provider)
  });

  const generationSpinner = clack.spinner();
  generationSpinner.start(`Generating LinkedIn JSON with ${provider} (${providerOptions.model})`);

  const { outputPath: generatedPath, result, providerConfig } = await generateLinkedinProfiles({
    sourcePath,
    provider,
    providerOptions,
    languages,
    answers,
    outputPath
  });

  generationSpinner.stop('LinkedIn JSON generated');
  const htmlPath = writeLinkedinHtmlReport({ result, jsonPath: generatedPath });
  success(`Provider: ${providerConfig.label}`);
  success(`Model: ${providerConfig.model}`);
  success(`Output: ${path.relative(process.cwd(), generatedPath)}`);
  success(`HTML: ${path.relative(process.cwd(), htmlPath)}`);

  const estimatedTotal = estimate.available ? fmtUsd(estimate.totalCost) : '$0.00';
  clack.note(
    `Generated ${languages.length || preselectedLanguages.length || 1} languages using ${providerConfig.model}.\nEstimated Cost: ${estimatedTotal}`,
    'Operation Receipt'
  );
};

if (require.main === module) {
  runCliEntry(run);
}
