import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { applyOverrides, resolveOutputFilename } from './lib/config-loader';

const CONFIG = {
  srcDir: './src',
  distDir: './dist',
  templatePath: './templates/resume.hbs',
  defaultTheme: 'harvard'
};

const ensureDirectoryExistence = (filePath: string): boolean => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
  return true;
};

const getThemeCss = (themeName: string): string => {
  const themePath = `./themes/${themeName}.css`;
  try {
    return fs.readFileSync(themePath, 'utf8');
  } catch (_e) {
    console.warn(`Theme '${themeName}' not found. Falling back to default.`);
    return fs.readFileSync(`./themes/${CONFIG.defaultTheme}.css`, 'utf8');
  }
};

const findJsonFiles = (dir: string, fileList: string[] = []): string[] => {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
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

const getOutputFilename = (filePath: string): string => {
  const relativePath = path.relative(CONFIG.srcDir, filePath);
  const pathParts = relativePath.split(path.sep);

  if (pathParts.length >= 2) {
    const role = pathParts[0].toLowerCase();
    const lang = pathParts[pathParts.length - 2].toLowerCase();
    return resolveOutputFilename(lang, role);
  }

  return `resume-${Date.now()}.pdf`;
};

const build = async (): Promise<void> => {
  const selectedTheme = process.argv[2] || CONFIG.defaultTheme;
  console.log(`🎨 Using theme: ${selectedTheme}`);

  const templateSource = fs.readFileSync(CONFIG.templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);
  const css = getThemeCss(selectedTheme);

  const jsonFiles = findJsonFiles(CONFIG.srcDir);

  if (jsonFiles.length === 0) {
    console.error('No resume.json files found in src directory.');
    return;
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  for (const filePath of jsonFiles) {
    let resumeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const relativePath = path.relative(CONFIG.srcDir, filePath);
    const pathParts = relativePath.split(path.sep);
    const lang = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : 'en';

    resumeData = applyOverrides(resumeData);

    const htmlContent = template({
      resume: resumeData,
      css,
      lang,
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

Handlebars.registerHelper('formatDate', function (dateString: string, options: any) {
  if (!dateString) {
    const labels = options.data.root.resume && options.data.root.resume.labels;
    return labels && labels.present ? labels.present : 'Present';
  }

  const lang = options.data.root.lang || 'en';
  const localeMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES'
  };
  const locale = localeMap[lang] || 'en-US';

  const date = new Date(dateString);
  let formatted = date.toLocaleDateString(locale, { year: 'numeric', month: 'short' });

  if (lang === 'es') {
    formatted = formatted.replace('.', '');
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted.replace(/([A-Za-z]+)(\d)/, '$1 $2');
});

Handlebars.registerHelper('formatLongDate', function (dateString: string, options: any) {
  if (!dateString) {
    const labels = options.data.root.resume && options.data.root.resume.labels;
    return labels && labels.present ? labels.present : 'Present';
  }

  const lang = options.data.root.lang || 'en';
  const localeMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES'
  };
  const locale = localeMap[lang] || 'en-US';

  const date = new Date(dateString);
  let formatted = date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });

  if (lang === 'es') {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted.replace(/([A-Za-z]+)(\d)/, '$1 $2');
});

Handlebars.registerHelper('removeProtocol', function (url: string) {
  return url.replace(/(^\w+:|^)\/\//, '');
});

build();
