import * as fs from 'fs';
import * as path from 'path';

export const loadEnv = (): void => {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    return; // .env not found, skip
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const [key, ...valueParts] = trimmed.split('=');
    const cleanKey = key?.trim();
    const cleanValue = valueParts.join('=').trim();

    if (cleanKey && !process.env[cleanKey]) {
      process.env[cleanKey] = cleanValue;
    }
  });
};
