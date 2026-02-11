const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const configLoader = require('./lib/config-loader');

const CONFIG = {
    srcDir: './src',
    distDir: './dist',
    templatePath: './templates/resume.hbs',
    defaultTheme: 'harvard' 
};


const ensureDirectoryExistence = (filePath) => {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
};


const getThemeCss = (themeName) => {
    const themePath = `./themes/${themeName}.css`;
    try {
        return fs.readFileSync(themePath, 'utf8');
    } catch (e) {
        console.warn(`Theme '${themeName}' not found. Falling back to default.`);
        return fs.readFileSync(`./themes/${CONFIG.defaultTheme}.css`, 'utf8');
    }
};


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

const getOutputFilename = (filePath) => {
    const relativePath = path.relative(CONFIG.srcDir, filePath);
    const pathParts = relativePath.split(path.sep);

    // Expected structure: [role]/[lang]/resume.json
    if (pathParts.length >= 2) {
        const role = pathParts[0].toLowerCase();
        const lang = pathParts[pathParts.length - 2].toLowerCase();
        return configLoader.resolveOutputFilename(lang, role);
    }
    
    return `resume-${Date.now()}.pdf`;
};

const build = async () => {
    const selectedTheme = process.argv[2] || CONFIG.defaultTheme;
    console.log(`🎨 Using theme: ${selectedTheme}`);

    const templateSource = fs.readFileSync(CONFIG.templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    const css = getThemeCss(selectedTheme);

    const jsonFiles = findJsonFiles(CONFIG.srcDir);

    if (jsonFiles.length === 0) {
        console.error("No resume.json files found in src directory.");
        return;
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    for (const filePath of jsonFiles) {
        let resumeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Apply persona-specific overrides if they exist
        resumeData = configLoader.applyOverrides(resumeData);

        const htmlContent = template({
            resume: resumeData,
            css: css,
            meta: {
                generatedAt: new Date().toLocaleDateString(),
                theme: selectedTheme
            }
        });

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
            },
            tagged: true,
            displayHeaderFooter: false,
            preferCSSPageSize: false,
            omitBackground: false,
            scale: 0.98
        });
        
        console.log(`✅ Generated PDF: ${outputPath}`);
    }

    await browser.close();
    console.log(`\n🎉 Build complete! Check the '${CONFIG.distDir}' folder.`);
};


Handlebars.registerHelper('formatDate', function(dateString, options) {
    if (!dateString) {
        const labels = options.data.root.resume && options.data.root.resume.labels;
        return (labels && labels.present) ? labels.present : 'Present';
    }
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    // Add space between month and year: "Jan2025" -> "Jan 2025"
    return formatted.replace(/([A-Za-z]+)(\d)/, '$1 $2');
});

Handlebars.registerHelper('removeProtocol', function(url) {
    return url.replace(/(^\w+:|^)\/\//, '');
});


build();