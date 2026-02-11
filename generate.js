const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Configuration
const CONFIG = {
    srcDir: './src',
    distDir: './dist',
    templatePath: './templates/resume.hbs',
    // Default theme, can be overridden via command line arg: node generate.js minimal
    defaultTheme: 'modern' 
};

// Helper: Ensure directory exists
const ensureDirectoryExistence = (filePath) => {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
};

// Helper: Get theme CSS
const getThemeCss = (themeName) => {
    const themePath = `./themes/${themeName}.css`;
    try {
        return fs.readFileSync(themePath, 'utf8');
    } catch (e) {
        console.warn(`Theme '${themeName}' not found. Falling back to default.`);
        return fs.readFileSync(`./themes/${CONFIG.defaultTheme}.css`, 'utf8');
    }
};

// Helper: Recursively find JSON files
const findJsonFiles = (dir, fileList = []) => {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            findJsonFiles(filePath, fileList);
        } else if (file === 'resume.json') {
            fileList.push(filePath);
        }
    });
    
    return fileList;
};

// Main Build Function
const build = () => {
    // 1. Get selected theme from CLI args or default
    const selectedTheme = process.argv[2] || CONFIG.defaultTheme;
    console.log(`🎨 Using theme: ${selectedTheme}`);

    // 2. Load Template and CSS
    const templateSource = fs.readFileSync(CONFIG.templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    const css = getThemeCss(selectedTheme);

    // 3. Find all resume.json files
    const jsonFiles = findJsonFiles(CONFIG.srcDir);

    if (jsonFiles.length === 0) {
        console.error("No resume.json files found in src directory.");
        return;
    }

    // 4. Process each file
    jsonFiles.forEach(filePath => {
        // Read JSON data
        const resumeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Determine output path (mirroring src structure)
        // e.g., src/en/backend/resume.json -> dist/en/backend/index.html
        const relativePath = path.relative(CONFIG.srcDir, filePath);
        const outputDir = path.dirname(path.join(CONFIG.distDir, relativePath));
        const outputPath = path.join(outputDir, 'index.html');

        // Render HTML
        const html = template({
            resume: resumeData,
            css: css,
            meta: {
                generatedAt: new Date().toLocaleDateString(),
                theme: selectedTheme
            }
        });

        // Write file
        ensureDirectoryExistence(outputPath);
        fs.writeFileSync(outputPath, html);
        
        console.log(`✅ Generated: ${outputPath}`);
    });

    console.log(`\n🎉 Build complete! Check the '${CONFIG.distDir}' folder.`);
};

// Register Handlebars Helpers
Handlebars.registerHelper('formatDate', function(dateString) {
    if (!dateString) return 'Present';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
});

Handlebars.registerHelper('removeProtocol', function(url) {
    return url.replace(/(^\w+:|^)\/\//, '');
});

// Run
build();