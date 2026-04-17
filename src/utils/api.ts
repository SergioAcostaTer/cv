import OpenAI from 'openai';
import { z } from 'zod';
import { loadEnv } from './env-loader';

export const providerSchema = z.enum(['openai', 'deepseek']);
export type ProviderId = z.infer<typeof providerSchema>;

const modelSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  label: z.string(),
  cost: z.string(),
  note: z.string(),
  inputPer1M: z.number().nullable().optional(),
  outputPer1M: z.number().nullable().optional()
});

export type ModelCatalogItem = z.infer<typeof modelSchema>;

export type ClientConfig = {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

export const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5-mini',
    apiKeyEnv: 'OPENAI_API_KEY'
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY'
  }
} as const;

export type ProviderConfig = {
  provider: ProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export const MODEL_CATALOG: ModelCatalogItem[] = [
  {
    id: 'gpt-5',
    provider: 'openai',
    label: 'GPT-5',
    cost: 'Est. $5.00 input / $15.00 output per 1M tokens',
    note: 'Highest quality',
    inputPer1M: 5,
    outputPer1M: 15
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    label: 'GPT-5 Mini',
    cost: 'Est. $1.00 input / $3.00 output per 1M tokens',
    note: 'Best quality/cost balance',
    inputPer1M: 1,
    outputPer1M: 3
  },
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    label: 'GPT-5 Nano',
    cost: 'Est. $0.20 input / $0.80 output per 1M tokens',
    note: 'Lowest cost',
    inputPer1M: 0.2,
    outputPer1M: 0.8
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    label: 'GPT-4.1',
    cost: 'Est. $2.00 input / $8.00 output per 1M tokens',
    note: 'Strong fallback',
    inputPer1M: 2,
    outputPer1M: 8
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    label: 'GPT-4.1 Mini',
    cost: 'Est. $0.40 input / $1.60 output per 1M tokens',
    note: 'Fast and affordable',
    inputPer1M: 0.4,
    outputPer1M: 1.6
  },
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    label: 'DeepSeek Chat',
    cost: 'Pricing varies by DeepSeek account plan',
    note: 'General-purpose DeepSeek model',
    inputPer1M: null,
    outputPer1M: null
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    label: 'DeepSeek Reasoner',
    cost: 'Pricing varies by DeepSeek account plan',
    note: 'Reasoning-focused DeepSeek model',
    inputPer1M: null,
    outputPer1M: null
  }
].map((item) => modelSchema.parse(item));

export const getModelsForProvider = (provider: ProviderId): ModelCatalogItem[] =>
  MODEL_CATALOG.filter((model) => model.provider === provider);

export const resolveProviderConfig = (config: ClientConfig): ProviderConfig => {
  loadEnv();

  const preset = PROVIDERS[config.provider];
  const apiKey = config.apiKey ?? process.env[preset.apiKeyEnv] ?? process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error(`Missing API key for ${preset.label}. Set ${preset.apiKeyEnv} or AI_API_KEY.`);
  }

  return {
    provider: config.provider,
    label: preset.label,
    baseUrl: config.baseUrl ?? preset.baseUrl,
    apiKey,
    model: config.model || preset.defaultModel
  };
};

export const createAIClient = (config: ClientConfig): { client: OpenAI; providerConfig: ProviderConfig } => {
  const providerConfig = resolveProviderConfig(config);

  return {
    client: new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseUrl
    }),
    providerConfig
  };
};
