import type { LibraryPayload, MarkdownSection } from '../../types';

export const splitMarkdownSections = (raw: string): MarkdownSection[] => {
  const levelTwo = [...raw.matchAll(/^##\s+(.+)$/gmu)];
  const levelThree = [...raw.matchAll(/^###\s+(.+)$/gmu)];
  const matches = levelTwo.length > 1 ? levelTwo : levelThree;

  if (!matches.length) {
    return [{ title: 'Full Content', markdown: raw }];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? raw.length) : raw.length;

    return {
      title: String(match[1] ?? `Section ${index + 1}`).trim(),
      markdown: raw.slice(start, end).trim()
    };
  });
};

export const buildLibrarySignature = (payload: LibraryPayload): string =>
  JSON.stringify({
    resumes: payload.resumes.map((item) => [item.path, item.modifiedAt]),
    linkedinDrafts: payload.linkedinDrafts.map((item) => [item.path, item.modifiedAt]),
    roadmaps: payload.roadmaps.map((item) => [item.path, item.modifiedAt])
  });
