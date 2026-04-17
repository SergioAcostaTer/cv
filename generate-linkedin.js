#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { PROVIDERS, generateLinkedinProfiles } = require('./lib/linkedin-generator');

const loadDotEnv = (envPath = '.env') => {
    const absolutePath = path.resolve(envPath);
    if (!fs.existsSync(absolutePath)) {
        return;
    }

    const envContent = fs.readFileSync(absolutePath, 'utf8');
    const lines = envContent.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '');

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
};

const printHelp = () => {
    console.log([
        'AI LinkedIn generator',
        '',
        'Usage:',
        '  npm run linkedin',
        '  node generate-linkedin.js',
        '',
        'Optional flags:',
        '  --provider openai|deepseek|custom',
        '  --resume src/backend/en/resume.json',
        '  --languages en,es',
        '  --output dist/linkedin.json',
        '  --model <model>',
        '  --api-key <key>',
        '  --base-url <url>   (for custom provider)',
        '',
        'Environment variables:',
        '  OPENAI_API_KEY, DEEPSEEK_API_KEY, AI_API_KEY'
    ].join('\n'));
};

const parseArgs = (argv) => {
    const args = {};

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            continue;
        }

        const key = token.slice(2);
        const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;

        args[key] = value;
        if (value !== true) {
            i += 1;
        }
    }

    return args;
};

const findResumeFiles = (baseDir) => {
    const files = [];

    const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (entry.isFile() && entry.name === 'resume.json') {
                files.push(fullPath);
            }
        }
    };

    walk(baseDir);
    return files;
};

const inferPathRecommendation = ({ optimizationGoal, roleFocus, hasFrontend }) => {
    const goal = optimizationGoal.toLowerCase();
    const role = roleFocus.toLowerCase();

    if (goal.includes('salary') || goal.includes('higher-paid') || goal.includes('compensation')) {
        return 'backend';
    }

    if (role.includes('payments') || role.includes('distributed') || role.includes('java')) {
        return 'backend';
    }

    if (hasFrontend) {
        return 'backend-focused-fullstack';
    }

    return 'backend';
};

const ask = async (rl, label, fallback) => {
    const suffix = fallback ? ` (${fallback})` : '';
    const value = await rl.question(`${label}${suffix}: `);
    return value && value.trim() ? value.trim() : fallback;
};

const chooseProviderInteractively = async (rl, fallback) => {
    const options = Object.keys(PROVIDERS).concat('custom');
    const answer = (await ask(rl, `Provider [${options.join('|')}]`, fallback || 'openai')).toLowerCase();
    return options.includes(answer) ? answer : fallback || 'openai';
};

const chooseResumeInteractively = async (rl, fallbackPath) => {
    const sourceDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(sourceDir)) {
        return fallbackPath || 'src/backend/en/resume.json';
    }

    const files = findResumeFiles(sourceDir);
    const display = files.map((filePath, idx) => `${idx + 1}. ${path.relative(process.cwd(), filePath)}`).join('\n');

    if (display) {
        console.log('\nAvailable resume files:\n');
        console.log(display);
        console.log('');
    }

    const selected = await ask(rl, 'Resume path or list number', fallbackPath || 'src/backend/en/resume.json');

    const asNumber = Number(selected);
    if (!Number.isNaN(asNumber) && Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= files.length) {
        return path.relative(process.cwd(), files[asNumber - 1]);
    }

    return selected;
};

const run = async () => {
    loadDotEnv();

    const args = parseArgs(process.argv.slice(2));

    if (args.help || args.h) {
        printHelp();
        return;
    }

    const rl = readline.createInterface({ input, output });

    try {
        console.log('\nLinkedIn JSON generator\n');

        const provider = await chooseProviderInteractively(rl, args.provider || 'openai');
        const resumePath = await chooseResumeInteractively(rl, args.resume || 'src/backend/en/resume.json');

        const optimizationGoal = await ask(
            rl,
            'What should this optimize for? (higher salary, more interviews, remote global roles, etc.)',
            'higher salary and stronger backend positioning'
        );

        const roleFocus = await ask(
            rl,
            'Role focus (example: backend payments, backend platform, full-stack)',
            'backend payments and distributed systems'
        );

        const targetSeniority = await ask(rl, 'Target seniority', 'mid-senior');
        const targetMarket = await ask(rl, 'Target market', 'EU and international remote');
        const roleKeywords = await ask(
            rl,
            'Optional recruiter keywords (comma separated)',
            'Java, Spring Boot, Payments, Kafka, Microservices, OpenAPI'
        );

        const constraints = await ask(
            rl,
            'Any constraints (avoid buzzwords, avoid claims, focus on leadership, etc.)',
            'Do not invent metrics or responsibilities'
        );

        const hasFrontendAnswer = await ask(rl, 'Do you want to emphasize frontend too? yes/no', 'no');
        const hasFrontend = String(hasFrontendAnswer).toLowerCase().startsWith('y');

        const recommendedPath = inferPathRecommendation({ optimizationGoal, roleFocus, hasFrontend });
        console.log(`\nSuggested path based on your answers: ${recommendedPath}\n`);

        const preferredPath = await ask(rl, 'Preferred path (backend|backend-focused-fullstack|fullstack)', recommendedPath);
        const languagesInput = await ask(rl, 'Languages (comma separated)', args.languages || 'en,es');
        const outputPath = await ask(rl, 'Output file path', args.output || 'dist/linkedin.json');

        const providerOptions = {
            model: args.model,
            apiKey: args['api-key'],
            baseUrl: args['base-url']
        };

        if (provider === 'custom') {
            providerOptions.baseUrl = providerOptions.baseUrl || (await ask(rl, 'Custom provider base URL', ''));
            providerOptions.model = providerOptions.model || (await ask(rl, 'Custom model', ''));
            providerOptions.apiKey = providerOptions.apiKey || (await ask(rl, 'Custom API key', ''));
        }

        const languages = languagesInput
            .split(',')
            .map((lang) => lang.trim().toLowerCase())
            .filter(Boolean);

        const answers = {
            optimizationGoal,
            roleFocus,
            targetSeniority,
            targetMarket,
            roleKeywords: roleKeywords
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            constraints,
            preferredPath
        };

        const { outputPath: generatedPath, providerConfig } = await generateLinkedinProfiles({
            resumePath,
            provider,
            providerOptions,
            languages,
            answers,
            outputPath
        });

        console.log('LinkedIn profile JSON generated successfully.');
        console.log(`Provider: ${providerConfig.label}`);
        console.log(`Model: ${providerConfig.model}`);
        console.log(`Output: ${generatedPath}`);
    } finally {
        rl.close();
    }
};

run().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});
