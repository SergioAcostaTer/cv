const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// Configuration
const CONFIG = {
    srcDir: './src',
    distDir: './dist',
    templatePath: './templates/resume.hbs',
    defaultTheme: 'harvard' 
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

// Helper: Determine output filename
const getOutputFilename = (filePath) => {
    // Example path: src/es/backend/resume.json
    const parts = filePath.split(path.sep);
    // Returning relative path to analyze structure
    const relativePath = path.relative(CONFIG.srcDir, filePath);
    const pathParts = relativePath.split(path.sep);

    // Expected structure: [lang]/[role]/resume.json
    if (pathParts.length >= 2) {
        const lang = pathParts[0].toLowerCase();
        const role = pathParts[pathParts.length - 2].toLowerCase(); // role is the parent folder of resume.json
        return `sergio-${role}-${lang}.pdf`; // Lowercase as requested
    }
    
    // Fallback
    return `resume-${Date.now()}.pdf`;
};

// Main Build Function
const build = async () => {
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

    // Launch Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // 4. Process each file
    for (const filePath of jsonFiles) {
        // Read JSON data
        const resumeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Generate HTML content
        const htmlContent = template({
            resume: resumeData,
            css: css,
            meta: {
                generatedAt: new Date().toLocaleDateString(),
                theme: selectedTheme
            }
        });

        // Set content and generate PDF
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        
        const outputFilename = getOutputFilename(filePath);
        const outputPath = path.join(CONFIG.distDir, outputFilename);

        ensureDirectoryExistence(outputPath);
        
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0px',
                bottom: '0px',
                left: '0px',
                right: '0px'
            }
        });
        
        console.log(`✅ Generated PDF: ${outputPath}`);
    }

    await browser.close();
    console.log(`\n🎉 Build complete! Check the '${CONFIG.distDir}' folder.`);
};

// Register Handlebars Helpers
Handlebars.registerHelper('formatDate', function(dateString) {
    if (!dateString) return 'Present';
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    // Add space between month and year: "Jan2025" -> "Jan 2025"
    return formatted.replace(/([A-Za-z]+)(\d)/, '$1 $2');
});

Handlebars.registerHelper('removeProtocol', function(url) {
    return url.replace(/(^\w+:|^)\/\//, '');
});

// Run
build();