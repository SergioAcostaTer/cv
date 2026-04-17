import { describe, expect, it } from 'vitest';
import { getDashboardHtml } from '../src/utils/dashboard-html';

describe('dashboard-html', () => {
  it('returns a full HTML document with library APIs and polling', () => {
    const html = getDashboardHtml();

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('CV Studio Dashboard');
    expect(html).toContain('/api/library');
    expect(html).toContain('/api/file');
    expect(html).toContain('setInterval(() => {');
    expect(html).toContain("void loadLibrary('poll');");
    expect(html).toContain('Library updated');
  });
});
