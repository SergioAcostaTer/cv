import { getPersonaConfig, type PersonaConfig } from '../core/runtime';

export const loadPersonaConfig = (): PersonaConfig => getPersonaConfig();

export const resolveOutputFilename = (lang: string, role: string): string => {
  const config = getPersonaConfig();
  const dateString = new Date().toISOString().split('T')[0] ?? '';

  return config.outputNaming
    .replaceAll('{persona}', config.personaId)
    .replaceAll('{role}', role)
    .replaceAll('{lang}', lang)
    .replaceAll('{date}', dateString);
};
