import { useEffect, useState } from 'react';
import { fetchArtifactText } from '../features/library/api';
import { splitMarkdownSections } from '../features/library/markdown';
import type { MarkdownSection, Selection } from '../types';

export const useArtifactContent = (selection: Selection | null): {
  rawMarkdown: string;
  sections: MarkdownSection[];
  clearContent: () => void;
} => {
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [sections, setSections] = useState<MarkdownSection[]>([]);

  useEffect(() => {
    if (!selection || selection.category === 'resumes') {
      return;
    }

    let cancelled = false;

    const loadFile = async (): Promise<void> => {
      const text = await fetchArtifactText(selection.item.path);
      if (cancelled) {
        return;
      }

      setRawMarkdown(text);
      setSections(splitMarkdownSections(text));
    };

    void loadFile();

    return () => {
      cancelled = true;
    };
  }, [selection]);

  const clearContent = (): void => {
    setRawMarkdown('');
    setSections([]);
  };

  return {
    rawMarkdown,
    sections,
    clearContent
  };
};
