import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const personaConfigSchema = z.object({
  personaId: z.string().default('default'),
  displayName: z.string().default('Resume'),
  defaultLanguage: z.string().default('en'),
  defaultRole: z.string().default('developer'),
  outputNaming: z.string().default('{persona}-{role}-{lang}.pdf')
});

export type PersonaConfig = z.infer<typeof personaConfigSchema>;

export type AppPaths = {
  rootDir: string;
  srcDir: string;
  distDir: string;
  profilesDir: string;
  templatesDir: string;
  themesDir: string;
  configDir: string;
  defaultResumePath: string;
  exampleResumePath: string;
  linkedinOutputPath: string;
};

type RuntimeContext = {
  persona: PersonaConfig;
  paths: AppPaths;
};

const projectRoot = path.resolve(__dirname, '..', '..');

const defaultConfig: PersonaConfig = {
  personaId: 'default',
  displayName: 'Resume',
  defaultLanguage: 'en',
  defaultRole: 'developer',
  outputNaming: '{persona}-{role}-{lang}.pdf'
};

let cachedRuntime: RuntimeContext | null = null;

const readPersonaConfig = (): PersonaConfig => {
  const configPath = path.join(projectRoot, 'config', 'persona.config.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return personaConfigSchema.parse(JSON.parse(raw));
  } catch {
    return defaultConfig;
  }
};

const buildPaths = (persona: PersonaConfig): AppPaths => {
  const srcDir = path.join(projectRoot, 'src');
  const distDir = path.join(projectRoot, 'dist');
  const profilesDir = path.join(projectRoot, 'data', 'local');

  return {
    rootDir: projectRoot,
    srcDir,
    distDir,
    profilesDir,
    templatesDir: path.join(projectRoot, 'templates'),
    themesDir: path.join(projectRoot, 'themes'),
    configDir: path.join(projectRoot, 'config'),
    defaultResumePath: path.join(profilesDir, persona.defaultRole, persona.defaultLanguage, 'resume.json'),
    exampleResumePath: path.join(projectRoot, 'data', 'examples', 'resume.example.json'),
    linkedinOutputPath: path.join(distDir, 'linkedin.json')
  };
};

export const getRuntime = (): RuntimeContext => {
  if (!cachedRuntime) {
    const persona = readPersonaConfig();
    cachedRuntime = {
      persona,
      paths: buildPaths(persona)
    };
  }

  return cachedRuntime;
};

export const getProjectRoot = (): string => getRuntime().paths.rootDir;
export const getPersonaConfig = (): PersonaConfig => getRuntime().persona;
export const getAppPaths = (): AppPaths => getRuntime().paths;
