import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeLinkedinHtmlReport, writeResumeIndexHtml } from '../src/utils/html-export';
import type { LinkedinResult } from '../src/utils/linkedin-generator';

const createResult = (): LinkedinResult => ({
  meta: {
    generatedAt: '2026-04-17T00:00:00.000Z',
    sourceJsonPath: 'C:/workspace/data/local/backend/en/resume.json',
    provider: 'OpenAI',
    model: 'gpt-5-mini',
    languages: ['en'],
    optimizationGoal: 'visibility',
    preferredPath: 'backend',
    targetMarket: 'global',
    targetSeniority: 'senior'
  },
  profile: {
    en: {
      profile: {
        fullName: 'Sergio <Acosta>',
        headline: 'Senior Engineer & Architect',
        location: 'Madrid',
        industry: 'Software',
        customUrlSlug: 'sergio-acosta',
        openToWork: ['Backend roles']
      },
      about: {
        short: 'Short summary',
        long: 'Long summary',
        descriptionToPaste: 'I build APIs and systems at scale.',
        valueProposition: 'Scale and reliability',
        callToAction: 'Let us talk.'
      },
      experience: [
        {
          title: 'Staff Engineer',
          company: 'Acme & Co',
          employmentType: 'Full-time',
          location: 'Remote',
          startDate: '2022-01',
          endDate: 'Present',
          description: 'Designed platform architecture and migration plans.',
          techContext: ['TypeScript', 'Node.js', 'PostgreSQL'],
          achievements: ['Improved uptime by 20%']
        }
      ],
      education: [],
      projects: [],
      skills: {
        top: ['System Design', 'Node.js'],
        byCategory: [],
        keywords: ['distributed systems', 'platform engineering']
      },
      languages: [],
      certifications: [],
      recommendations: {
        targetRoles: [],
        targetCompanies: [],
        searchKeywords: []
      }
    }
  }
});

describe('html-export', () => {
  const tmpRoots: string[] = [];

  afterEach(() => {
    for (const dir of tmpRoots) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpRoots.length = 0;
  });

  it('writes a LinkedIn HTML report next to JSON output with escaped content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-html-'));
    tmpRoots.push(tmpDir);

    const jsonPath = path.join(tmpDir, 'linkedin.json');
    const htmlPath = writeLinkedinHtmlReport({ result: createResult(), jsonPath });
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(path.basename(htmlPath)).toBe('linkedin.html');
    expect(html).toContain('LinkedIn Draft Board');
    expect(html).toContain('data-copy-target="en-about"');
    expect(html).toContain('OpenAI');
    expect(html).toContain('Sergio &lt;Acosta&gt;');
    expect(html).toContain('btn-copy');
  });

  it('renders fallback empty experience section when no experience exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-html-'));
    tmpRoots.push(tmpDir);

    const result = createResult();
    result.profile.en.experience = [];
    const htmlPath = writeLinkedinHtmlReport({ result, jsonPath: path.join(tmpDir, 'linkedin.json') });
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('No experience entries found.');
  });

  it('uses fallback headline/value and renders empty tags when lists are empty', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-html-'));
    tmpRoots.push(tmpDir);

    const result = createResult();
    result.profile.en.profile.headline = '';
    result.profile.en.profile.location = '';
    result.profile.en.about.valueProposition = 'Platform Architect';
    result.profile.en.skills.top = [];
    result.profile.en.skills.keywords = [];
    result.profile.en.experience[0]!.techContext = [];

    const htmlPath = writeLinkedinHtmlReport({ result, jsonPath: path.join(tmpDir, 'linkedin.json') });
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('Platform Architect');
    expect(html).toContain('Sergio &lt;Acosta&gt; </p>');
    expect(html).toContain('<span class="empty">None</span>');
  });

  it('writes dist index page with PDF links and empty fallback', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-html-'));
    tmpRoots.push(tmpDir);

    const first = path.join(tmpDir, 'sergio backend en.pdf');
    const second = path.join(tmpDir, 'sergio-backend-es.pdf');
    const htmlPath = writeResumeIndexHtml({ distDir: tmpDir, pdfPaths: [first, second] });
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(path.basename(htmlPath)).toBe('index.html');
    expect(html).toContain('Resume Outputs');
    expect(html).toContain('Open PDF');
    expect(html).toContain('sergio%20backend%20en.pdf');

    const emptyHtmlPath = writeResumeIndexHtml({ distDir: tmpDir, pdfPaths: [] });
    const emptyHtml = fs.readFileSync(emptyHtmlPath, 'utf8');
    expect(emptyHtml).toContain('No PDF files generated yet.');
  });
});
