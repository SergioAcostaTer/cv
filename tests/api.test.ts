import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/env-loader', () => ({
  loadEnv: vi.fn()
}));

import {
    MODEL_CATALOG,
    PROVIDERS,
    createAIClient,
    getModelsForProvider,
    resolveProviderConfig
} from '../src/utils/api';
import { loadEnv } from '../src/utils/env-loader';

describe('api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_API_KEY;
  });

  it('contains expected model catalog entries', () => {
    const ids = MODEL_CATALOG.map((item) => item.id);

    expect(ids).toContain('gpt-5');
    expect(ids).toContain('gpt-5-mini');
    expect(ids).toContain('gpt-5-nano');
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('gpt-4o-mini');
    expect(ids).toContain('deepseek-chat');
    expect(ids).toContain('deepseek-reasoner');
  });

  it('filters models by provider', () => {
    const openaiModels = getModelsForProvider('openai');
    const deepseekModels = getModelsForProvider('deepseek');

    expect(openaiModels.every((model) => model.provider === 'openai')).toBe(true);
    expect(deepseekModels.every((model) => model.provider === 'deepseek')).toBe(true);
  });

  it('uses provider-specific API key and defaults', () => {
    process.env.OPENAI_API_KEY = 'openai-key';

    const result = resolveProviderConfig({
      provider: 'openai',
      model: ''
    });

    expect(loadEnv).toHaveBeenCalled();
    expect(result).toEqual({
      provider: 'openai',
      label: 'OpenAI',
      baseUrl: PROVIDERS.openai.baseUrl,
      apiKey: 'openai-key',
      model: PROVIDERS.openai.defaultModel
    });
  });

  it('falls back to AI_API_KEY for provider auth', () => {
    process.env.AI_API_KEY = 'fallback-key';

    const result = resolveProviderConfig({
      provider: 'deepseek',
      model: 'deepseek-chat'
    });

    expect(result.apiKey).toBe('fallback-key');
  });

  it('throws when no API key is available', () => {
    expect(() =>
      resolveProviderConfig({
        provider: 'deepseek',
        model: 'deepseek-reasoner'
      })
    ).toThrow('Missing API key for DeepSeek');
  });

  it('creates OpenAI client with resolved provider configuration', () => {
    process.env.DEEPSEEK_API_KEY = 'deepseek-key';

    const result = createAIClient({
      provider: 'deepseek',
      model: 'deepseek-reasoner'
    });

    expect(result.providerConfig.provider).toBe('deepseek');
    expect(result.providerConfig.apiKey).toBe('deepseek-key');
    expect(result.client).toBeDefined();
  });
});
