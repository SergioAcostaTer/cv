import { useEffect, useState } from 'react';
import { fetchArtifactText } from '../features/library/api';
import { splitMarkdownSections } from '../features/library/markdown';
import type { ArtifactKind, LinkedinJson, MarkdownSection, ResumeJson, Selection } from '../types';

const resolveArtifactKind = (selection: Selection | null): ArtifactKind => {
  if (!selection) {
    return 'unknown';
  }

  if (selection.category === 'resumes') {
    return 'pdf';
  }

  const lower = selection.item.filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return 'markdown';
  }

  if (lower.endsWith('.json')) {
    if (lower.includes('linkedin')) {
      return 'linkedin-json';
    }

    if (lower.includes('resume')) {
      return 'resume-json';
    }

    return 'json';
  }

  return 'unknown';
};

export const useArtifactContent = (selection: Selection | null): {
  rawContent: string;
  sections: MarkdownSection[];
  parsedJson: LinkedinJson | ResumeJson | Record<string, unknown> | null;
  kind: ArtifactKind;
  clearContent: () => void;
} => {
  const [rawContent, setRawContent] = useState('');
  const [sections, setSections] = useState<MarkdownSection[]>([]);
  const [parsedJson, setParsedJson] = useState<LinkedinJson | ResumeJson | Record<string, unknown> | null>(null);
  const [kind, setKind] = useState<ArtifactKind>('unknown');

  useEffect(() => {
    if (!selection) {
      setKind('unknown');
      return;
    }

    const currentKind = resolveArtifactKind(selection);
    setKind(currentKind);

    if (currentKind === 'pdf') {
      return;
    }

    let cancelled = false;

    const loadFile = async (): Promise<void> => {
      const text = await fetchArtifactText(selection.item.path);
      if (cancelled) {
        return;
      }

      setRawContent(text);

      if (currentKind === 'markdown') {
        setParsedJson(null);
        setSections(splitMarkdownSections(text));
        return;
      }

      if (currentKind === 'linkedin-json' || currentKind === 'resume-json' || currentKind === 'json') {
        setSections([]);
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          setParsedJson(parsed);
        } catch {
          setParsedJson(null);
        }
        return;
      }

      setParsedJson(null);
      setSections([]);
    };

    void loadFile();

    return () => {
      cancelled = true;
    };
  }, [selection]);

  const clearContent = (): void => {
    setRawContent('');
    setSections([]);
    setParsedJson(null);
    setKind('unknown');
  };

  return {
    rawContent,
    sections,
    parsedJson,
    kind,
    clearContent
  };
};
