import fs from 'fs';
import path from 'path';
import { getPersonaConfig, getProjectRoot, type PersonaConfig } from '../core/runtime';

export const loadPersonaConfig = (): PersonaConfig => getPersonaConfig();

const formatTimestamp = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

export const resolveOutputFilename = (lang: string, role: string): string => {
  const config = getPersonaConfig();
  const now = new Date();
  const dateString = now.toISOString().split('T')[0] ?? '';
  const timestamp = formatTimestamp(now);

  return config.outputNaming
    .replaceAll('{persona}', config.personaId)
    .replaceAll('{role}', role)
    .replaceAll('{lang}', lang)
    .replaceAll('{date}', dateString)
    .replaceAll('{timestamp}', timestamp);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = (baseValue: unknown, overrideValue: unknown): unknown => {
  if (Array.isArray(overrideValue)) {
    return overrideValue.slice();
  }

  if (!isPlainObject(overrideValue)) {
    return overrideValue;
  }

  const baseObject = isPlainObject(baseValue) ? baseValue : {};
  const merged: Record<string, unknown> = { ...baseObject };

  for (const [key, value] of Object.entries(overrideValue)) {
    merged[key] = key in baseObject ? deepMerge(baseObject[key], value) : deepMerge(undefined, value);
  }

  return merged;
};

export const applyOverrides = <T extends object>(resumeData: T): T => {
  const { personaId } = getPersonaConfig();
  const overridePath = path.join(getProjectRoot(), 'config', 'overrides', `${personaId}.json`);

  if (!fs.existsSync(overridePath)) {
    return resumeData;
  }

  const rawOverride = fs.readFileSync(overridePath, 'utf8');
  const parsedOverride = JSON.parse(rawOverride) as unknown;

  if (!isPlainObject(parsedOverride)) {
    return resumeData;
  }

  return deepMerge(resumeData, parsedOverride) as T;
};
