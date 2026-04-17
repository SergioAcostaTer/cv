import * as clack from '@clack/prompts';
import clipboardy from 'clipboardy';
import fs from 'fs';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import open from 'open';
import path from 'path';
import pc from 'picocolors';
import { getAppPaths } from '../core/runtime';
import { getModelsForProvider, type ClientConfig, type ModelCatalogItem, type ProviderId } from '../utils/api';
import {
    generateLinkedinProfiles,
    generateStrategyOptions,
    getProviderModelCatalog,
    type GeneratorAnswers,
    type LinkedinResult
} from '../utils/linkedin-generator';
import { clearScreen, colors, note, runCliEntry, secondary, success, unwrapCancel, warning } from '../utils/ui';

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

export type LinkedinRunOptions = {
  provider?: string;
  model?: string;
  languages?: string;
  apiKey?: string;
  baseUrl?: string;
};

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

const formatTimestamp = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const buildLinkedinDraftMarkdown = (result: LinkedinResult): string => {
  const sections = Object.entries(result.profile)
    .map(([language, profile]) => {
      const experience = profile.experience
        .map(
          (item) =>
            `### ${item.title} @ ${item.company}\n${item.startDate} - ${item.endDate} (${item.location})\n\n${item.description}`
        )
        .join('\n\n');

      return [
        `## ${language.toUpperCase()}`,
        `### Headline`,
        profile.profile.headline || profile.about.valueProposition || 'No headline generated.',
        `### About`,
        profile.about.descriptionToPaste,
        `### Experience`,
        experience || 'No experience blocks generated.'
      ].join('\n\n');
    })
    .join('\n\n---\n\n');

  return [
    '# LinkedIn Draft',
    '',
    `- Provider: ${result.meta.provider}`,
    `- Model: ${result.meta.model}`,
    `- Generated: ${result.meta.generatedAt}`,
    '',
    sections
  ].join('\n');
};

const buildHeadlineAboutMarkdown = (result: LinkedinResult): string => {
  const body = Object.entries(result.profile)
    .map(([language, profile]) => {
      return [
        `## ${language.toUpperCase()}`,
        `### Headline`,
        profile.profile.headline || profile.about.valueProposition || 'No headline generated.',
        `### About`,
        profile.about.descriptionToPaste
      ].join('\n\n');
    })
    .join('\n\n---\n\n');

  return `# Headline & About\n\n${body}`;
};

const buildExperienceMarkdown = (result: LinkedinResult): string => {
  const body = Object.entries(result.profile)
    .map(([language, profile]) => {
      const blocks = profile.experience
        .map(
          (item) =>
            `### ${item.title} @ ${item.company}\n${item.startDate} - ${item.endDate} (${item.location})\n\n${item.description}`
        )
        .join('\n\n');

      return `## ${language.toUpperCase()}\n\n${blocks || 'No experience blocks generated.'}`;
    })
    .join('\n\n---\n\n');

  return `# Experience Blocks\n\n${body}`;
};

const renderMarkdownToTerminal = async (markdown: string): Promise<void> => {
  const rendered = marked.parse(markdown);
  const output = typeof rendered === 'string' ? rendered : await rendered;
  process.stdout.write(`${output}${output.endsWith('\n') ? '' : '\n'}\n`);
};

const copyToClipboardSafely = (text: string): void => {
  try {
    clipboardy.writeSync(text);
    clack.log.success('Copied to clipboard!');
  } catch (clipboardError: unknown) {
    clack.log.error(
      `Clipboard unavailable in this environment: ${clipboardError instanceof Error ? clipboardError.message : String(clipboardError)}`
    );
  }
};

const waitForEnter = async (): Promise<void> => {
  const result = await clack.text({
    message: 'Press Enter to return to dashboard',
    defaultValue: ''
  });

  unwrapCancel(result, 'Dashboard closed.');
};

const runLinkedinDashboard = async (input: {
  result: LinkedinResult;
  draftPath: string;
  jsonPath: string;
}): Promise<void> => {
  while (true) {
    clearScreen();
    clack.intro(`${pc.bold(colors.primary('LinkedIn Dashboard'))} ${secondary('archive + clipboard tools')}`);
    note(
      `JSON: ${path.relative(process.cwd(), input.jsonPath)}\nDraft: ${path.relative(process.cwd(), input.draftPath)}`,
      'Generation Archive'
    );

    const action = await clack.select({
      message: 'Choose an action',
      options: [
        { value: 'view-headline-about', label: 'View Headline & About' },
        { value: 'copy-about', label: 'Copy About Section to Clipboard' },
        { value: 'view-experience', label: 'View Experience Blocks' },
        { value: 'copy-experience', label: 'Copy Experience Blocks to Clipboard' },
        { value: 'open-draft', label: 'Open Markdown Draft in Editor' },
        { value: 'exit', label: 'Exit' }
      ]
    });

    const selected = unwrapCancel(action, 'Dashboard closed.');

    if (selected === 'exit') {
      return;
    }

    if (selected === 'view-headline-about') {
      clearScreen();
      await renderMarkdownToTerminal(buildHeadlineAboutMarkdown(input.result));
      await waitForEnter();
      continue;
    }

    if (selected === 'copy-about') {
      const aboutText = Object.entries(input.result.profile)
        .map(([language, profile]) => `### ${language.toUpperCase()}\n\n${profile.about.descriptionToPaste}`)
        .join('\n\n---\n\n');
      copyToClipboardSafely(aboutText);
      await waitForEnter();
      continue;
    }

    if (selected === 'view-experience') {
      clearScreen();
      await renderMarkdownToTerminal(buildExperienceMarkdown(input.result));
      await waitForEnter();
      continue;
    }

    if (selected === 'copy-experience') {
      const experienceText = Object.entries(input.result.profile)
        .map(([language, profile]) => {
          const blocks = profile.experience
            .map((item) => `${item.title} @ ${item.company}\n${item.startDate} - ${item.endDate}\n${item.description}`)
            .join('\n\n');
          return `### ${language.toUpperCase()}\n\n${blocks || 'No experience blocks generated.'}`;
        })
        .join('\n\n---\n\n');
      copyToClipboardSafely(experienceText);
      await waitForEnter();
      continue;
    }

    if (selected === 'open-draft') {
      try {
        await open(input.draftPath);
        clack.log.success('Opened markdown draft in your default editor.');
      } catch (openError: unknown) {
        warning(`Could not open markdown draft: ${openError instanceof Error ? openError.message : String(openError)}`);
      }
      await waitForEnter();
    }
  }
};

export const run = async (options?: LinkedinRunOptions): Promise<void> => {
  configureMarkdownRenderer();
  const { defaultResumePath, historyDir } = getAppPaths();

  const sourcePath = await chooseSourceJson(path.relative(process.cwd(), defaultResumePath));
  if (!sourcePath) {
    return;
  }

  const initialProvider = String(options?.provider || 'openai').toLowerCase() === 'deepseek' ? 'deepseek' : 'openai';
  const provider = await chooseProvider(initialProvider);
  const bootstrapModel = await chooseModel(provider, options?.model);
  const preselectedLanguages = String(options?.languages || 'en,es')
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  const providerOptions: ClientConfig = {
    provider,
    model: bootstrapModel,
    apiKey: options?.apiKey,
    baseUrl: options?.baseUrl
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

  const strategyOptions = strategy.options.options;
  const recommended = strategy.options.recommended;
  const goals = normalizeOptions(strategyOptions.goals);
  const positionings = normalizeOptions(strategyOptions.positioningAngles);
  const markets = normalizeOptions(strategyOptions.targetMarkets);
  const seniorities = normalizeOptions(strategyOptions.seniorityTracks);
  const modelOptions = normalizeOptions(strategyOptions.modelOptions);
  const constraintsProfiles = normalizeOptions(strategyOptions.constraintsProfiles);
  const keywordClusters = strategyOptions.keywordClusters.map((cluster) => ({
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
  const selectedKeywordCluster = strategyOptions.keywordClusters.find((cluster) => cluster.label === selectedKeywordClusterName);
  const languagesInput = await chooseLanguages(preselectedLanguages.join(',') || 'en,es');
  const roleFocus = await askText('Role focus for the prompt', preferredPath);

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

  const timestamp = formatTimestamp(new Date());
  const linkedinHistoryDir = path.join(historyDir, 'linkedin', timestamp);
  const archivedJsonPath = path.join(linkedinHistoryDir, 'linkedin.json');
  const archivedDraftPath = path.join(linkedinHistoryDir, 'linkedin-draft.md');
  fs.mkdirSync(linkedinHistoryDir, { recursive: true });

  const generationSpinner = clack.spinner();
  generationSpinner.start(`Generating LinkedIn JSON with ${provider} (${providerOptions.model})`);

  const { outputPath: generatedPath, result, providerConfig } = await generateLinkedinProfiles({
    sourcePath,
    provider,
    providerOptions,
    languages,
    answers,
    outputPath: archivedJsonPath
  });

  const markdownDraft = buildLinkedinDraftMarkdown(result);
  fs.writeFileSync(archivedDraftPath, markdownDraft, 'utf8');

  generationSpinner.stop('LinkedIn profile archive generated');
  success(`Provider: ${providerConfig.label}`);
  success(`Model: ${providerConfig.model}`);
  success(`Archive: ${path.relative(process.cwd(), linkedinHistoryDir)}`);

  const estimatedTotal = estimate.available ? fmtUsd(estimate.totalCost) : '$0.00';
  clack.note(
    `Generated ${languages.length || preselectedLanguages.length || 1} languages using ${providerConfig.model}.\nEstimated Cost: ${estimatedTotal}`,
    'Operation Receipt'
  );

  await runLinkedinDashboard({
    result,
    draftPath: archivedDraftPath,
    jsonPath: generatedPath
  });
};

if (require.main === module) {
  runCliEntry(run);
}
