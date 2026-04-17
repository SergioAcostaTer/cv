import * as clack from '@clack/prompts';
import fs from 'fs';
import Handlebars from 'handlebars';
import path from 'path';
import puppeteer from 'puppeteer';
import { getAppPaths } from '../core/runtime';
import { resolveOutputFilename } from '../utils/config-loader';
import { error, info, note, secondary, success, unwrapCancel } from '../utils/ui';

const DEFAULT_THEME = 'harvard';

const ensureDirectoryExistence = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const getThemeCss = (themeName: string): string => {
  const { themesDir } = getAppPaths();
  const themePath = path.join(themesDir, `${themeName}.css`);

  try {
    return fs.readFileSync(themePath, 'utf8');
  } catch {
    return fs.readFileSync(path.join(themesDir, `${DEFAULT_THEME}.css`), 'utf8');
  }
};

const findJsonFiles = (dir: string, fileList: string[] = []): string[] => {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsonFiles(filePath, fileList);
    } else if (file === 'resume.json') {
      fileList.push(filePath);
    }
  }

  return fileList;
};

const getOutputFilename = (filePath: string): string => {
  const { profilesDir } = getAppPaths();
  const relativePath = path.relative(profilesDir, filePath);
  const pathParts = relativePath.split(path.sep);

  if (pathParts.length >= 2) {
    const role = pathParts[0]?.toLowerCase() ?? 'resume';
    const lang = pathParts[pathParts.length - 2]?.toLowerCase() ?? 'en';
    return resolveOutputFilename(lang, role);
  }

  return `resume-${Date.now()}.pdf`;
};

const listThemes = (): string[] => {
  const { themesDir } = getAppPaths();

  return fs
    .readdirSync(themesDir)
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => entry.replace(/\.css$/u, ''))
    .sort((a, b) => a.localeCompare(b));
};

export const run = async (options?: { theme?: string }): Promise<void> => {
  const { profilesDir, distDir, templatesDir, exampleResumePath } = getAppPaths();
  const jsonFiles = findJsonFiles(profilesDir);

  if (jsonFiles.length === 0) {
    note(
      `No local resume JSON was found.\nCreate one at ${path.relative(process.cwd(), getAppPaths().defaultResumePath)}.\nReference example: ${path.relative(process.cwd(), exampleResumePath)}`,
      'Create JSON First'
    );
    return;
  }

  const themeChoices = listThemes();
  let selectedTheme = options?.theme;

  if (!selectedTheme) {
    const theme = await clack.select({
      message: 'Choose a resume theme',
      options: themeChoices.map((item) => ({
        value: item,
        label: item === DEFAULT_THEME ? `${item} ${secondary('(default)')}` : item
      })),
      initialValue: themeChoices.includes(DEFAULT_THEME) ? DEFAULT_THEME : themeChoices[0]
    });

    selectedTheme = unwrapCancel(theme, 'Resume build cancelled.');
  }

  const templateSource = fs.readFileSync(path.join(templatesDir, 'resume.hbs'), 'utf8');
  const template = Handlebars.compile(templateSource);
  const css = getThemeCss(selectedTheme);
  const spinner = clack.spinner();
  spinner.start(`Building PDFs with theme ${selectedTheme}`);

  const browser = await puppeteer.launch();

  try {
    const page = await browser.newPage();

    for (const filePath of jsonFiles) {
      const resumeData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as object;
      const relativePath = path.relative(profilesDir, filePath);
      const pathParts = relativePath.split(path.sep);
      const lang = pathParts[pathParts.length - 2] ?? 'en';

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
      const outputPath = path.join(distDir, outputFilename);
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

      info(`Generated ${outputFilename}`);
    }

    spinner.stop('PDF build complete');
    success(`Resumes available in ${distDir}`);
  } finally {
    await browser.close();
  }
};

Handlebars.registerHelper('formatDate', function (dateString: string, options: Handlebars.HelperOptions) {
  if (!dateString) {
    const labels = (options.data.root.resume as { labels?: { present?: string } } | undefined)?.labels;
    return labels?.present ?? 'Present';
  }

  const lang = String((options.data.root as { lang?: string }).lang ?? 'en');
  const localeMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES'
  };
  const locale = localeMap[lang] ?? 'en-US';

  const date = new Date(dateString);
  let formatted = date.toLocaleDateString(locale, { year: 'numeric', month: 'short' });

  if (lang === 'es') {
    formatted = formatted.replace('.', '');
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted.replace(/([A-Za-z]+)(\d)/u, '$1 $2');
});

Handlebars.registerHelper('formatLongDate', function (dateString: string, options: Handlebars.HelperOptions) {
  if (!dateString) {
    const labels = (options.data.root.resume as { labels?: { present?: string } } | undefined)?.labels;
    return labels?.present ?? 'Present';
  }

  const lang = String((options.data.root as { lang?: string }).lang ?? 'en');
  const localeMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES'
  };
  const locale = localeMap[lang] ?? 'en-US';

  const date = new Date(dateString);
  let formatted = date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });

  if (lang === 'es') {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted.replace(/([A-Za-z]+)(\d)/u, '$1 $2');
});

Handlebars.registerHelper('removeProtocol', function (url: string) {
  return url.replace(/(^\w+:|^)\/\//u, '');
});

if (require.main === module) {
  run({ theme: process.argv[2] }).catch((runError: unknown) => {
    error(runError instanceof Error ? runError.message : String(runError));
    process.exit(1);
  });
}
