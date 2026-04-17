import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '../core/runtime';

let loaded = false;

export const loadEnv = (): void => {
  if (loaded) {
    return;
  }

  const envPath = path.join(getProjectRoot(), '.env');
  if (!fs.existsSync(envPath)) {
    loaded = true;
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    const cleanKey = key?.trim();
    const cleanValue = valueParts.join('=').trim();

    if (cleanKey && process.env[cleanKey] === undefined) {
      process.env[cleanKey] = cleanValue;
    }
  }

  loaded = true;
};
