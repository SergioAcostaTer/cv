import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('env-loader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('loads environment variables from .env and preserves existing values', async () => {
    vi.doMock('../src/core/runtime', () => ({
      getProjectRoot: () => 'C:/workspace/cv'
    }));

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '# comment\nOPENAI_API_KEY=from-file\nDEEPSEEK_API_KEY=from-file\nCUSTOM=value=with=equals\n' as never
    );

    process.env.OPENAI_API_KEY = 'existing';

    const { loadEnv } = await import('../src/utils/env-loader');
    loadEnv();

    expect(process.env.OPENAI_API_KEY).toBe('existing');
    expect(process.env.DEEPSEEK_API_KEY).toBe('from-file');
    expect(process.env.CUSTOM).toBe('value=with=equals');
  });

  it('does not re-read env file after first load', async () => {
    vi.doMock('../src/core/runtime', () => ({
      getProjectRoot: () => 'C:/workspace/cv'
    }));

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('OPENAI_API_KEY=once' as never);

    const { loadEnv } = await import('../src/utils/env-loader');
    loadEnv();
    loadEnv();

    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it('marks env as loaded when file is missing and skips subsequent checks', async () => {
    vi.doMock('../src/core/runtime', () => ({
      getProjectRoot: () => 'C:/workspace/cv'
    }));

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('SHOULD_NOT_READ=1' as never);

    const { loadEnv } = await import('../src/utils/env-loader');
    loadEnv();
    loadEnv();

    expect(existsSpy).toHaveBeenCalledTimes(1);
    expect(readSpy).not.toHaveBeenCalled();
  });
});
