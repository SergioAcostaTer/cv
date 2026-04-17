import fs from 'fs';
import path from 'path';

interface PersonaConfig {
  personaId: string;
  displayName: string;
  defaultLanguage: string;
  defaultRole: string;
  outputNaming: string;
  [key: string]: unknown;
}

const DEFAULT_CONFIG: PersonaConfig = {
  personaId: 'default',
  displayName: 'Resume',
  defaultLanguage: 'en',
  defaultRole: 'developer',
  outputNaming: '{persona}-{role}-{lang}.pdf'
};

let cachedConfig: PersonaConfig | null = null;

export const loadPersonaConfig = (): PersonaConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(__dirname, '..', 'config', 'persona.config.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    cachedConfig = JSON.parse(configData) as PersonaConfig;

    if (!cachedConfig.personaId) {
      console.warn('⚠️  personaId missing in config, using default');
      cachedConfig.personaId = DEFAULT_CONFIG.personaId;
    }

    if (!cachedConfig.outputNaming) {
      console.warn('⚠️  outputNaming missing in config, using default');
      cachedConfig.outputNaming = DEFAULT_CONFIG.outputNaming;
    }

    return cachedConfig;
  } catch (error: any) {
    console.warn(`⚠️  Could not load persona config: ${error.message}`);
    console.warn('Using default configuration');
    cachedConfig = { ...DEFAULT_CONFIG };
    return cachedConfig;
  }
};

export const getPersonaConfig = (): PersonaConfig => loadPersonaConfig();

export const resolveOutputFilename = (lang: string, role: string): string => {
  const config = getPersonaConfig();
  const template = config.outputNaming;

  const now = new Date();
  const dateString = now.toISOString().split('T')[0];

  const tokens: Record<string, string> = {
    '{persona}': config.personaId,
    '{role}': role,
    '{lang}': lang,
    '{date}': dateString
  };

  let filename = template;
  for (const [token, value] of Object.entries(tokens)) {
    filename = filename.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return filename;
};

const deepMerge = (target: any, source: any): any => {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
};

export const applyOverrides = <T extends object>(resumeData: T): T => {
  const config = getPersonaConfig();
  const overridePath = path.join(__dirname, '..', 'config', 'overrides', `${config.personaId}.json`);

  try {
    if (fs.existsSync(overridePath)) {
      const overrides = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
      return deepMerge(resumeData, overrides) as T;
    }
  } catch (error: any) {
    console.warn(`⚠️  Could not load overrides: ${error.message}`);
  }

  return resumeData;
};
