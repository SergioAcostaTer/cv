import * as clack from '@clack/prompts';
import fs from 'fs';
import path from 'path';
import { getAppPaths } from '../core/runtime';
import { type ClientConfig, getModelsForProvider, type ModelCatalogItem, type ProviderId } from '../utils/api';
import {
  generateLinkedinProfiles,
  generateStrategyOptions,
  getProviderModelCatalog,
  type GeneratorAnswers
} from '../utils/linkedin-generator';
import { error, note, secondary, success, unwrapCancel } from '../utils/ui';

type OptionItem = {
  label: string;
  value: string;
  reason: string;
  score: number;
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

export const run = async (providedArgs?: string[]): Promise<void> => {
  const args = parseArgs(providedArgs ?? process.argv.slice(2));
  const { defaultResumePath, linkedinOutputPath } = getAppPaths();

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
  const languagePlans = normalizeOptions(options.languagePlans);
  const modelOptions = normalizeOptions(options.modelOptions);
  const constraintsProfiles = normalizeOptions(options.constraintsProfiles);
  const keywordClusters = options.keywordClusters.map((cluster) => ({
    label: cluster.label,
    value: cluster.label,
    reason: cluster.reason,
    score: cluster.score
  }));

  providerOptions.model = await chooseAIOption('Select model', modelOptions, bootstrapModel);
  const optimizationGoal = await chooseAIOption('Select optimization goal', goals, recommended.goal);
  const preferredPath = await chooseAIOption('Select positioning angle', positionings, recommended.positioning);
  const targetMarket = await chooseAIOption('Select target market', markets, recommended.market);
  const targetSeniority = await chooseAIOption('Select seniority track', seniorities, recommended.seniority);
  const constraints = await chooseAIOption('Select writing constraints', constraintsProfiles, recommended.constraintsProfile);
  const selectedKeywordClusterName = await chooseAIOption('Select keyword cluster', keywordClusters, recommended.keywordCluster);
  const selectedKeywordCluster = options.keywordClusters.find((cluster) => cluster.label === selectedKeywordClusterName);
  const languageSelection = await chooseAIOption('Select language plan', languagePlans, recommended.languagePlan);
  const languagesInput = languageSelection === 'custom' ? await askText('Language codes', 'en,es') : languageSelection;
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

  if (estimate.available) {
    note(
      `Model: ${providerOptions.model}\nEstimated tokens in/out: ${estimate.totalInputTokens} / ${estimate.totalOutputTokens}\nEstimated cost in/out: ${fmtUsd(estimate.inputCost)} / ${fmtUsd(estimate.outputCost)}\nEstimated total cost: ${fmtUsd(estimate.totalCost)}`,
      'Estimated Cost'
    );
  } else {
    note(estimate.reason, 'Estimated Cost');
  }

  const generationSpinner = clack.spinner();
  generationSpinner.start(`Generating LinkedIn JSON with ${provider} (${providerOptions.model})`);

  const { outputPath: generatedPath, providerConfig } = await generateLinkedinProfiles({
    sourcePath,
    provider,
    providerOptions,
    languages,
    answers,
    outputPath
  });

  generationSpinner.stop('LinkedIn JSON generated');
  success(`Provider: ${providerConfig.label}`);
  success(`Model: ${providerConfig.model}`);
  success(`Output: ${path.relative(process.cwd(), generatedPath)}`);
};

if (require.main === module) {
  run().catch((runError: unknown) => {
    error(runError instanceof Error ? runError.message : String(runError));
    process.exit(1);
  });
}
