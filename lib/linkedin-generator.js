const fs = require('fs');
const path = require('path');

const PROVIDERS = {
    openai: {
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4.1-mini',
        envKey: 'OPENAI_API_KEY'
    },
    deepseek: {
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/chat/completions',
        defaultModel: 'deepseek-chat',
        envKey: 'DEEPSEEK_API_KEY'
    }
};

const readResumeFile = (resumePath) => {
    const absolutePath = path.resolve(resumePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    return {
        absolutePath,
        data: JSON.parse(content)
    };
};

const sanitizeJsonFromModel = (content) => {
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

const buildSystemPrompt = (language) => {
    const isSpanish = language.toLowerCase() === 'es';

    return [
        'You are an expert LinkedIn profile writer for software engineers.',
        'Return only valid JSON. No prose, no markdown, no extra keys.',
        'Use concise, high-impact language with measurable outcomes when available.',
        'Do not invent facts. If a detail is missing, optimize wording around provided info only.',
        isSpanish
            ? 'Write all content in Spanish (Spain), natural and professional.'
            : 'Write all content in English, natural and professional.',
        'Output schema:',
        '{',
        '  "headline": "string <= 220 chars",',
        '  "about": "string 3-6 short paragraphs separated by \\n\\n",',
        '  "topSkills": ["string", "..."],',
        '  "experienceBullets": ["string", "..."],',
        '  "keywords": ["string", "..."],',
        '  "targetRoles": ["string", "..."],',
        '  "callToAction": "string"',
        '}'
    ].join('\n');
};

const buildUserPrompt = ({ resumeData, answers, language }) => {
    return JSON.stringify(
        {
            task: 'Generate a high-performance LinkedIn profile draft based on this resume and goals.',
            language,
            goals: {
                optimization: answers.optimizationGoal,
                targetMarket: answers.targetMarket,
                targetSeniority: answers.targetSeniority,
                preferredPath: answers.preferredPath,
                roleFocus: answers.roleFocus,
                roleKeywords: answers.roleKeywords,
                constraints: answers.constraints
            },
            resume: resumeData,
            hardRules: [
                'Do not fabricate company names, timelines, metrics, or technologies.',
                'Keep each experience bullet under 180 characters.',
                'Top skills should be a maximum of 18 entries.',
                'Keywords should be recruiter/ATS-friendly terms.'
            ]
        },
        null,
        2
    );
};

const resolveProviderConfig = (providerName, overrides = {}) => {
    const provider = (providerName || '').toLowerCase();

    if (provider === 'custom') {
        if (!overrides.baseUrl) {
            throw new Error('Custom provider requires a baseUrl.');
        }

        if (!overrides.apiKey) {
            throw new Error('Custom provider requires an apiKey.');
        }

        if (!overrides.model) {
            throw new Error('Custom provider requires a model.');
        }

        return {
            provider: 'custom',
            label: 'Custom',
            baseUrl: overrides.baseUrl,
            apiKey: overrides.apiKey,
            model: overrides.model
        };
    }

    const preset = PROVIDERS[provider];
    if (!preset) {
        throw new Error(`Unsupported provider: ${providerName}`);
    }

    const apiKey = overrides.apiKey || process.env[preset.envKey] || process.env.AI_API_KEY;
    if (!apiKey) {
        throw new Error(
            `Missing API key for ${preset.label}. Set ${preset.envKey} (or AI_API_KEY), or pass --api-key.`
        );
    }

    return {
        provider,
        label: preset.label,
        baseUrl: overrides.baseUrl || preset.baseUrl,
        apiKey,
        model: overrides.model || preset.defaultModel
    };
};

const requestCompletion = async ({ providerConfig, language, resumeData, answers, temperature = 0.4 }) => {
    const response = await fetch(providerConfig.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify({
            model: providerConfig.model,
            temperature,
            messages: [
                {
                    role: 'system',
                    content: buildSystemPrompt(language)
                },
                {
                    role: 'user',
                    content: buildUserPrompt({ resumeData, answers, language })
                }
            ]
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(
            `Model request failed (${response.status} ${response.statusText}). Response: ${errText.slice(0, 500)}`
        );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Model response is missing choices[0].message.content');
    }

    const jsonText = sanitizeJsonFromModel(content);
    return JSON.parse(jsonText);
};

const generateLinkedinProfiles = async ({
    resumePath,
    provider,
    providerOptions,
    languages,
    answers,
    outputPath
}) => {
    const { absolutePath, data: resumeData } = readResumeFile(resumePath);
    const providerConfig = resolveProviderConfig(provider, providerOptions);

    const normalizedLanguages = Array.from(
        new Set((languages || []).map((lang) => String(lang).trim().toLowerCase()).filter(Boolean))
    );

    if (normalizedLanguages.length === 0) {
        throw new Error('At least one language is required (for example: en, es).');
    }

    const profiles = {};
    for (const language of normalizedLanguages) {
        profiles[language] = await requestCompletion({
            providerConfig,
            language,
            resumeData,
            answers
        });
    }

    const result = {
        meta: {
            generatedAt: new Date().toISOString(),
            sourceResumePath: absolutePath,
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

module.exports = {
    PROVIDERS,
    generateLinkedinProfiles,
    resolveProviderConfig
};
