import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/runtime', () => ({
  getPersonaConfig: vi.fn(),
  getProjectRoot: vi.fn()
}));

import { getPersonaConfig, getProjectRoot } from '../src/core/runtime';
import { applyOverrides, resolveOutputFilename } from '../src/utils/config-loader';

describe('config-loader', () => {
  const mockedGetPersonaConfig = vi.mocked(getPersonaConfig);
  const mockedGetProjectRoot = vi.mocked(getProjectRoot);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T10:00:00.000Z'));
    mockedGetPersonaConfig.mockReturnValue({
      personaId: 'sergio',
      displayName: 'Sergio',
      defaultLanguage: 'en',
      defaultRole: 'backend',
      outputNaming: '{persona}-{role}-{lang}-{date}.pdf'
    });
    mockedGetProjectRoot.mockReturnValue('C:/workspace/cv');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves output filename placeholders', () => {
    const filename = resolveOutputFilename('es', 'fullstack');

    expect(filename).toBe('sergio-fullstack-es-2026-04-17.pdf');
  });

  it('returns original data when no override file exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const input = { name: 'base', nested: { value: 1 } };

    const result = applyOverrides(input);

    expect(result).toBe(input);
  });

  it('deep merges override values and replaces arrays', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        headline: 'Overridden',
        nested: { keep: 'yes', overwrite: 'new' },
        skills: ['node', 'ts']
      }) as never
    );

    const input = {
      headline: 'Original',
      nested: { keep: 'yes', overwrite: 'old', untouched: true },
      skills: ['go'],
      location: 'Madrid'
    };

    const result = applyOverrides(input);

    expect(existsSpy).toHaveBeenCalledWith(path.join('C:/workspace/cv', 'config', 'overrides', 'sergio.json'));
    expect(readSpy).toHaveBeenCalled();
    expect(result).toEqual({
      headline: 'Overridden',
      nested: { keep: 'yes', overwrite: 'new', untouched: true },
      skills: ['node', 'ts'],
      location: 'Madrid'
    });
  });

  it('ignores invalid override payloads', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(['not-an-object']) as never);

    const input = { title: 'Engineer' };
    const result = applyOverrides(input);

    expect(result).toBe(input);
  });
});
