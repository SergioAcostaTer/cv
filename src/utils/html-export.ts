import fs from 'fs';
import path from 'path';
import type { LinkedinProfile, LinkedinResult } from './linkedin-generator';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toMultilineText = (values: string[]): string => values.filter(Boolean).join('\n');

const toTags = (values: string[]): string => {
  if (values.length === 0) {
    return '<span class="empty">None</span>';
  }

  return values.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('');
};

const buildExperienceBlock = (profile: LinkedinProfile, prefix: string): string => {
  if (profile.experience.length === 0) {
    return '<div class="empty">No experience entries found.</div>';
  }

  return profile.experience
    .map((item, index) => {
      const textareaId = `${prefix}-experience-${index}`;
      const header = `${item.title} at ${item.company}`.trim();

      return `
        <article class="panel panel-soft">
          <div class="panel-head">
            <h4>${escapeHtml(header)}</h4>
            <button type="button" class="btn-copy" data-copy-target="${escapeHtml(textareaId)}">Copy Description</button>
          </div>
          <p class="meta">${escapeHtml(item.startDate)} - ${escapeHtml(item.endDate)} | ${escapeHtml(item.location)}</p>
          <textarea id="${escapeHtml(textareaId)}" class="copy-area" readonly>${escapeHtml(item.description)}</textarea>
          <div class="chip-group">${toTags(item.techContext)}</div>
        </article>
      `;
    })
    .join('');
};

const buildLanguageSection = (language: string, profile: LinkedinProfile): string => {
  const slug = language.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const aboutId = `${slug}-about`;
  const headline = profile.profile.headline || profile.about.valueProposition || '';
  const topSkills = toMultilineText(profile.skills.top);
  const keywords = toMultilineText(profile.skills.keywords);

  return `
    <section class="card">
      <header class="card-head">
        <div>
          <p class="eyebrow">Language</p>
          <h2>${escapeHtml(language.toUpperCase())}</h2>
          <p class="meta">${escapeHtml(profile.profile.fullName)} ${profile.profile.location ? `- ${escapeHtml(profile.profile.location)}` : ''}</p>
        </div>
      </header>

      <div class="grid">
        <article class="panel">
          <div class="panel-head">
            <h3>Headline</h3>
            <button type="button" class="btn-copy" data-copy-value="${escapeHtml(headline)}">Copy</button>
          </div>
          <p>${escapeHtml(headline || 'No headline generated')}</p>
        </article>

        <article class="panel">
          <div class="panel-head">
            <h3>About (Paste Ready)</h3>
            <button type="button" class="btn-copy" data-copy-target="${escapeHtml(aboutId)}">Copy</button>
          </div>
          <textarea id="${escapeHtml(aboutId)}" class="copy-area" readonly>${escapeHtml(profile.about.descriptionToPaste)}</textarea>
        </article>

        <article class="panel">
          <div class="panel-head">
            <h3>Top Skills</h3>
            <button type="button" class="btn-copy" data-copy-value="${escapeHtml(topSkills)}">Copy</button>
          </div>
          <div class="chip-group">${toTags(profile.skills.top)}</div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <h3>Search Keywords</h3>
            <button type="button" class="btn-copy" data-copy-value="${escapeHtml(keywords)}">Copy</button>
          </div>
          <div class="chip-group">${toTags(profile.skills.keywords)}</div>
        </article>
      </div>

      <section class="stack">
        <h3>Experience</h3>
        ${buildExperienceBlock(profile, slug)}
      </section>
    </section>
  `;
};

const baseStyles = `
  :root {
    color-scheme: light;
    --bg: #f8fafc;
    --surface: #ffffff;
    --surface-soft: #f9fafb;
    --text: #0f172a;
    --muted: #475569;
    --line: #e2e8f0;
    --accent: #0f766e;
    --radius: 14px;
    --shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Segoe UI", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(circle at 90% 0%, rgba(15, 118, 110, 0.08), transparent 42%),
      radial-gradient(circle at 0% 100%, rgba(30, 64, 175, 0.08), transparent 38%),
      var(--bg);
    color: var(--text);
    padding: 32px 20px 60px;
    line-height: 1.45;
  }

  .container {
    width: min(1040px, 100%);
    margin: 0 auto;
  }

  .hero {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 24px;
    margin-bottom: 20px;
  }

  .hero h1 {
    margin: 0 0 8px;
    font-size: clamp(1.35rem, 2.2vw, 1.9rem);
    letter-spacing: -0.02em;
  }

  .meta {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
  }

  .stack { display: grid; gap: 14px; margin-top: 16px; }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
  }

  .card-head { margin-bottom: 14px; }

  .eyebrow {
    margin: 0 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.72rem;
    color: var(--muted);
    font-weight: 700;
  }

  .card h2 {
    margin: 0;
    font-size: 1.25rem;
    letter-spacing: -0.02em;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    padding: 14px;
  }

  .panel-soft {
    background: var(--surface-soft);
  }

  .panel h3,
  .panel h4 {
    margin: 0;
    font-size: 0.95rem;
    letter-spacing: -0.01em;
  }

  .panel p {
    margin: 8px 0 0;
    color: var(--muted);
  }

  .panel-head {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .btn-copy {
    border: 1px solid var(--line);
    background: #f8fafc;
    color: var(--text);
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    padding: 7px 11px;
    transition: all 120ms ease;
  }

  .btn-copy:hover {
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  .copy-area {
    margin-top: 8px;
    width: 100%;
    min-height: 130px;
    border-radius: 10px;
    border: 1px solid var(--line);
    padding: 10px;
    resize: vertical;
    font: inherit;
    color: var(--text);
    background: #fff;
  }

  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .tag {
    display: inline-flex;
    border-radius: 999px;
    border: 1px solid #dbe1ea;
    padding: 4px 10px;
    font-size: 0.78rem;
    color: #334155;
    background: #ffffff;
  }

  .empty {
    color: #64748b;
    font-size: 0.9rem;
  }

  .footer {
    margin-top: 16px;
    color: #64748b;
    font-size: 0.86rem;
  }

  @media (max-width: 640px) {
    body { padding: 16px 12px 34px; }
    .hero, .card { padding: 14px; }
    .panel-head { align-items: flex-start; flex-direction: column; }
  }
`;

const copyScript = `
  const copyFromValue = async (button) => {
    const copyValue = button.getAttribute('data-copy-value');
    const targetId = button.getAttribute('data-copy-target');
    const targetElement = targetId ? document.getElementById(targetId) : null;
    const text = copyValue ?? targetElement?.value ?? targetElement?.textContent ?? '';
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const previousText = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = previousText;
      }, 1200);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.focus();
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
  };

  for (const button of document.querySelectorAll('.btn-copy')) {
    button.addEventListener('click', () => {
      void copyFromValue(button);
    });
  }
`;

export const writeLinkedinHtmlReport = (input: { result: LinkedinResult; jsonPath: string }): string => {
  const htmlPath = path.resolve(input.jsonPath.replace(/\.json$/i, '.html'));

  const sections = Object.entries(input.result.profile)
    .map(([language, profile]) => buildLanguageSection(language, profile))
    .join('');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LinkedIn Draft Board</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="container">
      <section class="hero">
        <h1>LinkedIn Draft Board</h1>
        <p class="meta">Provider: ${escapeHtml(input.result.meta.provider)} | Model: ${escapeHtml(input.result.meta.model)}</p>
        <p class="meta">Generated: ${escapeHtml(input.result.meta.generatedAt)}</p>
      </section>
      <section class="stack">
        ${sections}
      </section>
      <p class="footer">This page is generated locally. Use copy buttons to move content into LinkedIn quickly.</p>
    </main>
    <script>${copyScript}</script>
  </body>
</html>`;

  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
};

export const writeResumeIndexHtml = (input: { distDir: string; pdfPaths: string[] }): string => {
  const htmlPath = path.join(path.resolve(input.distDir), 'index.html');
  const listItems = input.pdfPaths
    .map((pdfPath) => {
      const filename = path.basename(pdfPath);
      return `
        <article class="panel panel-soft">
          <div class="panel-head">
            <h3>${escapeHtml(filename)}</h3>
            <a class="btn-copy" href="${encodeURI(filename)}" target="_blank" rel="noreferrer noopener">Open PDF</a>
          </div>
        </article>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Resume Outputs</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="container">
      <section class="hero">
        <h1>Resume Outputs</h1>
        <p class="meta">Generated files in dist.</p>
      </section>
      <section class="stack">
        ${listItems || '<div class="empty">No PDF files generated yet.</div>'}
      </section>
      <p class="footer">Tip: keep this page open and refresh while watch mode is running.</p>
    </main>
  </body>
</html>`;

  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
};