const fs = require('fs');
const path = require('path');

/**
 * Configuration loader for persona-based resume generation
 * Provides centralized configuration management and token replacement
 */

const DEFAULT_CONFIG = {
    personaId: 'default',
    displayName: 'Resume',
    defaultLanguage: 'en',
    defaultRole: 'developer',
    outputNaming: '{persona}-{role}-{lang}.pdf'
};

let cachedConfig = null;

/**
 * Load persona configuration from config/persona.config.json
 * Falls back to defaults if file not found
 */
const loadPersonaConfig = () => {
    if (cachedConfig) {
        return cachedConfig;
    }

    const configPath = path.join(__dirname, '..', 'config', 'persona.config.json');
    
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        cachedConfig = JSON.parse(configData);
        
        // Validate required fields
        if (!cachedConfig.personaId) {
            console.warn('⚠️  personaId missing in config, using default');
            cachedConfig.personaId = DEFAULT_CONFIG.personaId;
        }
        
        if (!cachedConfig.outputNaming) {
            console.warn('⚠️  outputNaming missing in config, using default');
            cachedConfig.outputNaming = DEFAULT_CONFIG.outputNaming;
        }
        
        return cachedConfig;
    } catch (error) {
        console.warn(`⚠️  Could not load persona config: ${error.message}`);
        console.warn('Using default configuration');
        cachedConfig = { ...DEFAULT_CONFIG };
        return cachedConfig;
    }
};

/**
 * Get current persona configuration
 */
const getPersonaConfig = () => {
    return loadPersonaConfig();
};

/**
 * Replace tokens in output filename template
 * Supported tokens: {persona}, {role}, {lang}, {date}
 * 
 * @param {string} lang - Language code (e.g., 'en', 'es')
 * @param {string} role - Role name (e.g., 'backend', 'fullstack')
 * @returns {string} Resolved filename
 */
const resolveOutputFilename = (lang, role) => {
    const config = getPersonaConfig();
    const template = config.outputNaming;
    
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const tokens = {
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

/**
 * Load persona-specific overrides if they exist
 * Merges overrides with base resume data
 * 
 * @param {object} resumeData - Base resume data from JSON
 * @returns {object} Merged resume data with overrides applied
 */
const applyOverrides = (resumeData) => {
    const config = getPersonaConfig();
    const overridePath = path.join(__dirname, '..', 'config', 'overrides', `${config.personaId}.json`);
    
    try {
        if (fs.existsSync(overridePath)) {
            const overrides = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
            
            // Deep merge overrides into resume data
            return deepMerge(resumeData, overrides);
        }
    } catch (error) {
        console.warn(`⚠️  Could not load overrides: ${error.message}`);
    }
    
    // Return original data if no overrides or error
    return resumeData;
};

/**
 * Deep merge two objects (simple implementation)
 * Override properties from source into target
 */
const deepMerge = (target, source) => {
    const result = { ...target };
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    
    return result;
};

module.exports = {
    getPersonaConfig,
    resolveOutputFilename,
    applyOverrides,
    loadPersonaConfig
};
