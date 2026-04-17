import fs from 'fs';
import path from 'path';

export interface ProviderConfig {
  provider: 'openai';
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-5-mini',
    envKey: 'OPENAI_API_KEY'
  }
};

const readJsonFile = (inputPath: string): { absolutePath: string; data: any } => {
  const absolutePath = path.resolve(inputPath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  return {
    absolutePath,
    data: JSON.parse(content)
  };
};

const sanitizeJsonFromModel = (content: unknown): string => {
  const trimmed = String(content || '').trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  throw new Error('Model response does not contain valid JSON content.');
};

const buildSystemPrompt = (language: string): string => {
  const isSpanish = language.toLowerCase() === 'es';

  return [
    'You are an expert LinkedIn profile writer and career strategist for software engineers.',
    'Return only valid JSON. No prose, no markdown, no extra keys.',
    'Use concise, high-impact language with measurable outcomes when available.',
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
    '      "description": "string",',
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

const buildUserPrompt = ({ sourceData, answers, language }: { sourceData: any; answers: any; language: string }): string => {
  return JSON.stringify(
    {
      task: 'Generate a complete high-performance LinkedIn profile dataset based on this source data and goals.',
      language,
      goals: {
        optimization: answers.optimizationGoal,
        targetMarket: answers.targetMarket,
        targetSeniority: answers.targetSeniority,
        preferredPath: answers.preferredPath,
        roleFocus: answers.roleFocus,
        roleKeywords: answers.roleKeywords,
        constraints: answers.constraints,
        cvInsights: answers.cvInsights || null
      },
      sourceProfileData: sourceData,
      hardRules: [
        'Do not fabricate company names, timelines, metrics, or technologies.',
        'Experience achievement bullets must be under 180 characters each.',
        'Top skills should be a maximum of 25 entries.',
        'Keywords should be recruiter/ATS-friendly terms.',
        'Include as many fields as possible from schema, but do not invent missing factual data.',
        'Prefer null or empty arrays over fabricated values.'
      ]
    },
    null,
    2
  );
};

const buildStrategySystemPrompt = (): string => {
  return [
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
};

const buildStrategyUserPrompt = ({ sourceData, availableModels }: { sourceData: any; availableModels: Array<{ id: string; label: string; cost: string; note: string }> }): string => {
  return JSON.stringify(
    {
      task: 'Generate selector options optimized for career growth and compensation potential.',
      sourceProfileData: sourceData,
      availableModels,
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
};

export const resolveProviderConfig = (providerName: string, overrides: any = {}): ProviderConfig => {
  const provider = String(providerName || '').toLowerCase();

  if (provider && provider !== 'openai') {
    throw new Error('Only OpenAI is supported by this generator.');
  }

  const preset = PROVIDERS.openai;
  const apiKey = overrides.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(`Missing API key for ${preset.label}. Set OPENAI_API_KEY (or AI_API_KEY), or pass --api-key.`);
  }

  return {
    provider: 'openai',
    label: preset.label,
    baseUrl: overrides.baseUrl || preset.baseUrl,
    apiKey,
    model: overrides.model || preset.defaultModel
  };
};

const requestJsonCompletion = async ({ providerConfig, systemPrompt, userPrompt, temperature = 0.3 }: any): Promise<any> => {
  const modelName = String(providerConfig?.model || '').toLowerCase();
  const supportsCustomTemperature = !modelName.startsWith('gpt-5');

  const requestPayload: any = {
    model: providerConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };

  if (supportsCustomTemperature) {
    requestPayload.temperature = temperature;
  }

  const response = await fetch(providerConfig.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerConfig.apiKey}`
    },
    body: JSON.stringify(requestPayload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Model request failed (${response.status} ${response.statusText}). Response: ${errText.slice(0, 500)}`);
  }

  const responsePayload = await response.json();
  const content = responsePayload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Model response is missing choices[0].message.content');
  }

  const jsonText = sanitizeJsonFromModel(content);
  return JSON.parse(jsonText);
};

const requestCompletion = async ({ providerConfig, language, sourceData, answers, temperature = 0.4 }: any): Promise<any> => {
  return requestJsonCompletion({
    providerConfig,
    systemPrompt: buildSystemPrompt(language),
    userPrompt: buildUserPrompt({ sourceData, answers, language }),
    temperature
  });
};

const validateStrategyOptions = (options: any): void => {
  const root = options?.options;
  const requiredArrays = [
    'goals',
    'positioningAngles',
    'targetMarkets',
    'seniorityTracks',
    'languagePlans',
    'modelOptions',
    'constraintsProfiles',
    'keywordClusters'
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(root?.[key]) || root[key].length === 0) {
      throw new Error(`AI strategy response missing required non-empty array: options.${key}`);
    }
  }
};

export const generateStrategyOptions = async ({ inputPath, provider, providerOptions, availableModels }: any): Promise<any> => {
  const { absolutePath, data } = readJsonFile(inputPath);
  const providerConfig = resolveProviderConfig(provider, providerOptions);

  const options = await requestJsonCompletion({
    providerConfig,
    systemPrompt: buildStrategySystemPrompt(),
    userPrompt: buildStrategyUserPrompt({ sourceData: data, availableModels }),
    temperature: 0.2
  });

  validateStrategyOptions(options);

  return {
    inputPath: absolutePath,
    sourceData: data,
    options,
    providerConfig
  };
};

export const generateLinkedinProfiles = async ({
  sourcePath,
  resumePath,
  provider,
  providerOptions,
  languages,
  answers,
  outputPath
}: any): Promise<any> => {
  const selectedPath = sourcePath || resumePath;
  if (!selectedPath) {
    throw new Error('Missing sourcePath (or resumePath) for LinkedIn generation.');
  }

  const { absolutePath, data: sourceData } = readJsonFile(selectedPath);
  const providerConfig = resolveProviderConfig(provider, providerOptions);

  const normalizedLanguages: string[] = Array.from(
    new Set((languages || []).map((lang: string) => String(lang).trim().toLowerCase()).filter(Boolean))
  );

  if (normalizedLanguages.length === 0) {
    throw new Error('At least one language is required (for example: en, es).');
  }

  const profiles: Record<string, any> = {};
  for (const language of normalizedLanguages) {
    profiles[language] = await requestCompletion({
      providerConfig,
      language,
      sourceData,
      answers
    });
  }

  const result = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceJsonPath: absolutePath,
      provider: providerConfig.label,
      model: providerConfig.model,
      languages: normalizedLanguages,
      optimizationGoal: answers.optimizationGoal,
      preferredPath: answers.preferredPath,
      targetMarket: answers.targetMarket,
      targetSeniority: answers.targetSeniority
    },
    profile: profiles
  };

  const finalOutputPath = path.resolve(outputPath || 'dist/linkedin.json');
  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });
  fs.writeFileSync(finalOutputPath, JSON.stringify(result, null, 2), 'utf8');

  return {
    outputPath: finalOutputPath,
    result,
    providerConfig
  };
};
