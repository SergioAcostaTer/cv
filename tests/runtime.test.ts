import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeCache, getAppPaths, getPersonaConfig, getProjectRoot, getRuntime } from '../src/core/runtime';

describe('runtime', () => {
  beforeEach(() => {
    clearRuntimeCache();
    vi.restoreAllMocks();
  });

  it('caches runtime context until cleared', () => {
    const first = getRuntime();
    const second = getRuntime();

    expect(first).toBe(second);

    clearRuntimeCache();
    const third = getRuntime();
    expect(third).not.toBe(first);
  });

  it('creates required directories when paths are built', () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    clearRuntimeCache();
    const paths = getAppPaths();

    expect(mkdirSpy).toHaveBeenCalledWith(paths.profilesDir, { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(paths.configDir, { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(path.join(paths.configDir, 'overrides'), { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(paths.themesDir, { recursive: true });
  });

  it('builds default resume path from active persona settings', () => {
    const persona = getPersonaConfig();
    const paths = getAppPaths();
    const expectedSuffix = path.join(persona.defaultRole, persona.defaultLanguage, 'resume.json');

    expect(paths.defaultResumePath.endsWith(expectedSuffix)).toBe(true);
  });

  it('falls back to hardcoded persona config when config file cannot be read', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('missing config');
    });

    clearRuntimeCache();
    const persona = getPersonaConfig();

    expect(persona.personaId).toBe('default');
    expect(persona.defaultLanguage).toBe('en');
    expect(persona.defaultRole).toBe('developer');
  });

  it('applies schema defaults when persona config is partial', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{}' as never);

    clearRuntimeCache();
    const persona = getPersonaConfig();

    expect(persona.displayName).toBe('Resume');
    expect(persona.outputNaming).toBe('{persona}-{role}-{lang}.pdf');
  });

  it('returns project root through runtime accessor', () => {
    const root = getProjectRoot();

    expect(typeof root).toBe('string');
    expect(root.length).toBeGreaterThan(0);
    expect(path.isAbsolute(root)).toBe(true);
  });
});
