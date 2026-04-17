import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getAppPaths } from '../core/runtime';
import {
    createAIClient,
    getModelsForProvider,
    resolveProviderConfig,
    type ClientConfig,
    type ModelCatalogItem,
    type ProviderConfig,
    type ProviderId
} from './api';

const optionSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  reason: z.string().optional().default(''),
  score: z.number().min(0).max(100).catch(50)
});

const keywordClusterSchema = optionSchema.extend({
  keywords: z.array(z.string()).min(1)
});

const strategySchema = z.object({
  analysisSummary: z.string(),
  recommended: z.object({
    goal: z.string().optional(),
    positioning: z.string().optional(),
    market: z.string().optional(),
    seniority: z.string().optional(),
    languagePlan: z.string().optional(),
    constraintsProfile: z.string().optional(),
    keywordCluster: z.string().optional()
  }),
  options: z.object({
    goals: z.array(optionSchema).min(1),
    positioningAngles: z.array(optionSchema).min(1),
    targetMarkets: z.array(optionSchema).min(1),
    seniorityTracks: z.array(optionSchema).min(1),
    languagePlans: z.array(optionSchema).min(1),
    modelOptions: z.array(optionSchema).min(1),
    constraintsProfiles: z.array(optionSchema).min(1),
    keywordClusters: z.array(keywordClusterSchema).min(1)
  })
});

const linkedinProfileSchema = z.object({
  profile: z.object({
    fullName: z.string().default(''),
    headline: z.string().default(''),
    location: z.string().default(''),
    industry: z.string().default(''),
    customUrlSlug: z.string().default(''),
    openToWork: z.array(z.string()).default([])
  }),
  about: z.object({
    short: z.string().default(''),
    long: z.string().default(''),
    descriptionToPaste: z.string().default(''),
    valueProposition: z.string().default(''),
    callToAction: z.string().default('')
  }),
  experience: z
    .array(
      z.object({
        title: z.string().default(''),
        company: z.string().default(''),
        employmentType: z.string().default(''),
        location: z.string().default(''),
        startDate: z.string().default(''),
        endDate: z.string().default(''),
        description: z.string().default(''),
        techContext: z.array(z.string()).default([]),
        achievements: z.array(z.string()).default([])
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        school: z.string().default(''),
        degree: z.string().default(''),
        fieldOfStudy: z.string().default(''),
        startDate: z.string().default(''),
        endDate: z.string().default(''),
        description: z.string().default('')
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(''),
        role: z.string().default(''),
        description: z.string().default(''),
        technologies: z.array(z.string()).default([]),
        url: z.string().default('')
      })
    )
    .default([]),
  skills: z.object({
    top: z.array(z.string()).default([]),
    byCategory: z
      .array(
        z.object({
          category: z.string(),
          items: z.array(z.string())
        })
      )
      .default([]),
    keywords: z.array(z.string()).default([])
  }),
  languages: z
    .array(
      z.object({
        name: z.string(),
        proficiency: z.string()
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string(),
        issueDate: z.string().default(''),
        credentialId: z.string().default('')
      })
    )
    .default([]),
  recommendations: z.object({
    targetRoles: z.array(z.string()).default([]),
    targetCompanies: z.array(z.string()).default([]),
    searchKeywords: z.array(z.string()).default([])
  })
});

const linkedinResultSchema = z.object({
  meta: z.object({
    generatedAt: z.string(),
    sourceJsonPath: z.string(),
    provider: z.string(),
    model: z.string(),
    languages: z.array(z.string()),
    optimizationGoal: z.string(),
    preferredPath: z.string(),
    targetMarket: z.string(),
    targetSeniority: z.string()
  }),
  profile: z.record(z.string(), linkedinProfileSchema)
});

export type StrategyResponse = z.infer<typeof strategySchema>;
export type LinkedinProfile = z.infer<typeof linkedinProfileSchema>;
export type LinkedinResult = z.infer<typeof linkedinResultSchema>;

export type GeneratorAnswers = {
  optimizationGoal: string;
  roleFocus: string;
  targetSeniority: string;
  targetMarket: string;
  roleKeywords: string[];
  constraints: string;
  preferredPath: string;
  cvInsights: {
    analysisSummary: string;
    selector: {
      sourcePath: string;
      selectedKeywordCluster: string;
    };
  };
};

type StrategyOptionsInput = {
  inputPath: string;
  provider: ProviderId;
  providerOptions: ClientConfig;
  availableModels: ModelCatalogItem[];
};

type GenerateProfilesInput = {
  sourcePath?: string;
  resumePath?: string;
  provider: ProviderId;
  providerOptions: ClientConfig;
  languages: string[];
  answers: GeneratorAnswers;
  outputPath?: string;
};

const TRENDING_SKILL_PRIORITY: Record<string, number> = {
  postgresql: 100,
  postgres: 100,
  kubernetes: 98,
  aws: 97,
  azure: 96,
  gcp: 95,
  terraform: 94,
  docker: 93,
  python: 92,
  typescript: 91,
  node: 90,
  kotlin: 89,
  java: 88,
  spring: 87,
  kafka: 86,
  redis: 85,
  mongodb: 84,
  db2: 40
};

const normalizeSkill = (skill: string): string => skill.trim().toLowerCase().replace(/\s+/g, ' ');

const skillPriorityScore = (skill: string): number => {
  const normalized = normalizeSkill(skill);
  if (normalized in TRENDING_SKILL_PRIORITY) {
    return TRENDING_SKILL_PRIORITY[normalized] ?? 50;
  }

  if (normalized.includes('postgres')) {
    return TRENDING_SKILL_PRIORITY.postgresql;
  }

  if (normalized.includes('db2')) {
    return TRENDING_SKILL_PRIORITY.db2;
  }

  return 60;
};

const prioritizeTrendingSkills = (skills: string[]): string[] => {
  const withIndex = skills
    .map((skill, index) => ({
      skill,
      index,
      score: skillPriorityScore(skill)
    }))
    .filter((entry) => entry.skill.trim().length > 0);

  withIndex.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.index - right.index;
  });

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const entry of withIndex) {
    const key = normalizeSkill(entry.skill);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry.skill);
  }

  return deduped;
};

const prioritizeProfileSkills = (profile: LinkedinProfile): LinkedinProfile => {
  const top = prioritizeTrendingSkills(profile.skills.top);
  const keywords = prioritizeTrendingSkills(profile.skills.keywords);
  const byCategory = profile.skills.byCategory.map((group) => ({
    ...group,
    items: prioritizeTrendingSkills(group.items)
  }));

  const normalizedByCategory = byCategory.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.trim().length > 0)
  }));

  return {
    ...profile,
    skills: {
      ...profile.skills,
      top,
      keywords,
      byCategory: normalizedByCategory
    }
  };
};

const readJsonFile = (inputPath: string): { absolutePath: string; data: unknown } => {
  const absolutePath = path.resolve(inputPath);
  const content = fs.readFileSync(absolutePath, 'utf8');

  return {
    absolutePath,
    data: JSON.parse(content) as unknown
  };
};

const sanitizeJsonFromModel = (content: string): string => {
  const trimmed = content.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  throw new Error('Model response did not contain valid JSON.');
};

const buildSystemPrompt = (language: string): string => {
  const isSpanish = language.toLowerCase() === 'es';

  return [
    'You are an expert LinkedIn profile writer and career strategist for software engineers.',
    'Return only valid JSON. No prose, no markdown, no extra keys.',
    'Use natural, credible, conversational-professional language.',
    'Avoid sounding like marketing copy, inflated achievement claims, or forced bragging.',
    'Prefer concrete responsibilities, technical context, and collaboration details over hype.',
    'Do not invent facts. If a detail is missing, optimize wording around provided info only.',
    isSpanish
      ? 'Write all content in Spanish (Spain), natural and professional.'
      : 'Write all content in English, natural and professional.',
    'Output schema:',
    '{',
    '  "profile": {',
    '    "fullName": "string",',
    '    "headline": "string <= 220 chars",',
    '    "location": "string",',
    '    "industry": "string",',
    '    "customUrlSlug": "string",',
    '    "openToWork": ["string", "..."]',
    '  },',
    '  "about": {',
    '    "short": "string <= 2600 chars",',
    '    "long": "string 3-6 short paragraphs separated by \\n\\n",',
    '    "descriptionToPaste": "string 1200-2200 chars, ready to paste into LinkedIn About section",',
    '    "valueProposition": "string",',
    '    "callToAction": "string"',
    '  },',
    '  "experience": [',
    '    {',
    '      "title": "string",',
    '      "company": "string",',
    '      "employmentType": "string",',
    '      "location": "string",',
    '      "startDate": "YYYY-MM",',
    '      "endDate": "YYYY-MM or Present",',
    '      "description": "string 500-1200 chars, detailed, technical, paste-ready for LinkedIn Experience description",',
    '      "techContext": ["string", "..."],',
    '      "achievements": ["string <= 180 chars", "..."]',
    '    }',
    '  ],',
    '  "education": [',
    '    {',
    '      "school": "string",',
    '      "degree": "string",',
    '      "fieldOfStudy": "string",',
    '      "startDate": "YYYY-MM",',
    '      "endDate": "YYYY-MM or Expected",',
    '      "description": "string"',
    '    }',
    '  ],',
    '  "projects": [',
    '    {',
    '      "name": "string",',
    '      "role": "string",',
    '      "description": "string",',
    '      "technologies": ["string", "..."],',
    '      "url": "string"',
    '    }',
    '  ],',
    '  "skills": {',
    '    "top": ["string", "..."],',
    '    "byCategory": [',
    '      { "category": "string", "items": ["string", "..."] }',
    '    ],',
    '    "keywords": ["string", "..."]',
    '  },',
    '  "languages": [',
    '    { "name": "string", "proficiency": "string" }',
    '  ],',
    '  "certifications": [',
    '    { "name": "string", "issuer": "string", "issueDate": "YYYY-MM", "credentialId": "string" }',
    '  ],',
    '  "recommendations": {',
    '    "targetRoles": ["string", "..."],',
    '    "targetCompanies": ["string", "..."],',
    '    "searchKeywords": ["string", "..."]',
    '  }',
    '}'
  ].join('\n');
};

const buildUserPrompt = (input: { sourceData: unknown; answers: GeneratorAnswers; language: string }): string =>
  JSON.stringify(
    {
      task: 'Generate a complete high-performance LinkedIn profile dataset based on this source data and goals.',
      language: input.language,
      goals: {
        optimization: input.answers.optimizationGoal,
        targetMarket: input.answers.targetMarket,
        targetSeniority: input.answers.targetSeniority,
        preferredPath: input.answers.preferredPath,
        roleFocus: input.answers.roleFocus,
        roleKeywords: input.answers.roleKeywords,
        constraints: input.answers.constraints,
        cvInsights: input.answers.cvInsights
      },
      sourceProfileData: input.sourceData,
      hardRules: [
        'Do not fabricate company names, timelines, metrics, or technologies.',
        'about.descriptionToPaste must be a polished About text ready to paste into LinkedIn without edits.',
        'about.descriptionToPaste must clearly explain technical strengths, architecture decisions, and business impact.',
        'Each experience.description must explain scope, architecture, responsibilities, and concrete technologies used.',
        'Each experience.description must include technology names naturally in sentences (not only comma lists).',
        'Each experience.description must be exactly 3 concise paragraphs separated by blank lines.',
        'Do not use bullet points, numbered lists, or checklist formatting in experience.description.',
        'Paragraph 1 should explain what you did and the project/client/business context.',
        'Paragraph 2 should explain technologies, architecture, integrations, and responsibilities.',
        'Paragraph 3 should mention one natural, factual impact/achievement without hype.',
        'Write descriptions in a grounded first-person style when language/context allows (e.g., "I collaborate...", "I worked on...").',
        'Avoid exaggerated achievement framing; keep impact statements modest, factual, and integrated naturally into the narrative.',
        'Each experience.techContext must include 5 to 12 concrete technologies/tools actually used in that role.',
        'Experience achievements are optional; if used, keep them short, factual, and under 180 characters each.',
        'Top skills should be a maximum of 25 entries.',
        'When multiple valid technologies exist, place the most market-trending skill first in skills.top and skills.keywords (example: PostgreSQL before DB2) without deleting true enterprise experience.',
        'Keywords should be recruiter/ATS-friendly terms.',
        'Include as many fields as possible from schema, but do not invent missing factual data.',
        'Prefer null or empty arrays over fabricated values.'
      ]
    },
    null,
    2
  );

const buildStrategySystemPrompt = (): string =>
  [
    'You are an expert career strategist and LinkedIn growth advisor.',
    'Analyze the provided JSON profile data and generate dynamic option sets for a CLI selector.',
    'Return only valid JSON. No markdown and no extra keys.',
    'All options must be tailored to the input data and career growth potential.',
    'Output schema:',
    '{',
    '  "analysisSummary": "string",',
    '  "recommended": {',
    '    "goal": "string",',
    '    "positioning": "string",',
    '    "market": "string",',
    '    "seniority": "string",',
    '    "languagePlan": "string",',
    '    "constraintsProfile": "string",',
    '    "keywordCluster": "string"',
    '  },',
    '  "options": {',
    '    "goals": [{"label":"string","reason":"string","score":0}],',
    '    "positioningAngles": [{"label":"string","reason":"string","score":0}],',
    '    "targetMarkets": [{"label":"string","reason":"string","score":0}],',
    '    "seniorityTracks": [{"label":"string","reason":"string","score":0}],',
    '    "languagePlans": [{"label":"string","value":"string","reason":"string","score":0}],',
    '    "modelOptions": [{"label":"string","value":"string","reason":"string","score":0}],',
    '    "constraintsProfiles": [{"label":"string","reason":"string","score":0}],',
    '    "keywordClusters": [{"label":"string","keywords":["string"],"reason":"string","score":0}]',
    '  }',
    '}'
  ].join('\n');

const buildStrategyUserPrompt = (input: { sourceData: unknown; availableModels: ModelCatalogItem[] }): string =>
  JSON.stringify(
    {
      task: 'Generate selector options optimized for career growth and compensation potential.',
      sourceProfileData: input.sourceData,
      availableModels: input.availableModels.map((item) => ({
        id: item.id,
        label: item.label,
        cost: item.cost,
        note: item.note
      })),
      rules: [
        'Avoid generic options when specific options are possible from the data.',
        'Provide at least 4 options per selector list.',
        'Keep labels concise and practical for CLI display.',
        'keywordClusters must include 6 to 12 keywords each.',
        'Every option must include score from 0 to 100 where 100 means best recommendation for this specific profile.',
        'modelOptions values must exactly match ids from availableModels.'
      ]
    },
    null,
    2
  );

const requestJsonCompletion = async <T>(input: {
  providerConfig: ProviderConfig;
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}): Promise<T> => {
  const { client } = createAIClient(input.providerConfig);
  const modelName = input.providerConfig.model.toLowerCase();
  const supportsCustomTemperature = !modelName.startsWith('gpt-5');

  const completion = await client.chat.completions.create({
    model: input.providerConfig.model,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt }
    ],
    ...(supportsCustomTemperature ? { temperature: input.temperature } : {}),
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Model response was empty.');
  }

  const parsedJson = JSON.parse(sanitizeJsonFromModel(content)) as unknown;
  return input.schema.parse(parsedJson);
};

const requestCompletion = async (input: {
  providerConfig: ProviderConfig;
  language: string;
  sourceData: unknown;
  answers: GeneratorAnswers;
}): Promise<LinkedinProfile> =>
  requestJsonCompletion({
    providerConfig: input.providerConfig,
    schema: linkedinProfileSchema,
    systemPrompt: buildSystemPrompt(input.language),
    userPrompt: buildUserPrompt({
      sourceData: input.sourceData,
      answers: input.answers,
      language: input.language
    }),
    temperature: 0.4
  });

export const generateStrategyOptions = async (
  input: StrategyOptionsInput
): Promise<{
  inputPath: string;
  sourceData: unknown;
  options: StrategyResponse;
  providerConfig: ProviderConfig;
}> => {
  const { absolutePath, data } = readJsonFile(input.inputPath);
  const providerConfig = resolveProviderConfig(input.providerOptions);

  const options = await requestJsonCompletion({
    providerConfig,
    schema: strategySchema,
    systemPrompt: buildStrategySystemPrompt(),
    userPrompt: buildStrategyUserPrompt({
      sourceData: data,
      availableModels: input.availableModels
    }),
    temperature: 0.2
  });

  return {
    inputPath: absolutePath,
    sourceData: data,
    options,
    providerConfig
  };
};

export const generateLinkedinProfiles = async (
  input: GenerateProfilesInput
): Promise<{
  outputPath: string;
  result: LinkedinResult;
  providerConfig: ProviderConfig;
}> => {
  const selectedPath = input.sourcePath ?? input.resumePath;
  if (!selectedPath) {
    throw new Error('Missing sourcePath (or resumePath) for LinkedIn generation.');
  }

  const { absolutePath, data: sourceData } = readJsonFile(selectedPath);
  const providerConfig = resolveProviderConfig(input.providerOptions);
  const normalizedLanguages = Array.from(new Set(input.languages.map((lang) => lang.trim().toLowerCase()).filter(Boolean)));

  if (normalizedLanguages.length === 0) {
    throw new Error('At least one language is required.');
  }

  const profiles: Record<string, LinkedinProfile> = {};
  for (const language of normalizedLanguages) {
    const profile = await requestCompletion({
      providerConfig,
      language,
      sourceData,
      answers: input.answers
    });

    profiles[language] = prioritizeProfileSkills(profile);
  }

  const parsedResult = linkedinResultSchema.parse({
    meta: {
      generatedAt: new Date().toISOString(),
      sourceJsonPath: absolutePath,
      provider: providerConfig.label,
      model: providerConfig.model,
      languages: normalizedLanguages,
      optimizationGoal: input.answers.optimizationGoal,
      preferredPath: input.answers.preferredPath,
      targetMarket: input.answers.targetMarket,
      targetSeniority: input.answers.targetSeniority
    },
    profile: profiles
  });

  const finalOutputPath = path.resolve(input.outputPath ?? getAppPaths().linkedinOutputPath);
  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });
  fs.writeFileSync(finalOutputPath, JSON.stringify(parsedResult, null, 2), 'utf8');

  return {
    outputPath: finalOutputPath,
    result: parsedResult,
    providerConfig
  };
};

export const getProviderModelCatalog = (provider: ProviderId): ModelCatalogItem[] => getModelsForProvider(provider);
