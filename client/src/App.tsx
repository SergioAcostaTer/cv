import { useCallback, useEffect, useMemo, useState } from 'react';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MainArea } from './components/MainArea';
import { MainToolbar } from './components/MainToolbar';
import { StatusToast } from './components/StatusToast';
import { useArtifactContent } from './hooks/useArtifactContent';
import { useLibrary } from './hooks/useLibrary';
import { useLibraryEvents } from './hooks/useLibraryEvents';
import type { Category, Selection } from './types';

export const App = () => {
  const { library, signature, refreshLibrary } = useLibrary();
  const [selectedArtifact, setSelectedArtifact] = useState<Selection | null>(null);
  const [status, setStatus] = useState('');

  const { rawContent, sections, parsedJson, kind, clearContent } = useArtifactContent(selectedArtifact);

  const selectedKey = selectedArtifact ? `${selectedArtifact.category}:${selectedArtifact.item.path}` : null;

  const showStatus = useCallback((value: string): void => {
    setStatus(value);
    setTimeout(() => setStatus(''), 1200);
  }, []);

  const refreshWithStatus = useCallback(async (): Promise<void> => {
    await refreshLibrary();
  }, [refreshLibrary]);

  const handleLibraryUpdated = useCallback(() => {
    void refreshWithStatus();
    showStatus('Library updated');
  }, [refreshWithStatus, showStatus]);

  useLibraryEvents(handleLibraryUpdated);

  useEffect(() => {
    if (!selectedArtifact) {
      return;
    }

    const categoryItems = library[selectedArtifact.category] || [];
    const stillExists = categoryItems.some((item) => item.path === selectedArtifact.item.path);

    if (!stillExists) {
      setSelectedArtifact(null);
      clearContent();
    }
  }, [signature, library, selectedArtifact, clearContent]);

  const onSelect = useCallback(
    (category: Category, index: number): void => {
      const item = library[category][index];
      if (!item) {
        return;
      }

      setSelectedArtifact({ category, item });
      if (category === 'resumes') {
        clearContent();
      }
    },
    [library, clearContent]
  );

  const copyText = useCallback(
    async (value: string, label: string): Promise<void> => {
      if (!value) {
        return;
      }

      await navigator.clipboard.writeText(value);
      showStatus(`${label} copied`);
    },
    [showStatus]
  );

  const title = useMemo(() => selectedArtifact?.item.filename ?? 'Select an artifact from the sidebar', [selectedArtifact]);

  return (
    <>
      <div className="grid h-full grid-cols-1 grid-rows-[38dvh_1fr] lg:grid-cols-[340px_1fr] lg:grid-rows-1">
        <LibrarySidebar library={library} selectedKey={selectedKey} onSelect={onSelect} />

        <main className="min-h-0 overflow-hidden border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
          <MainToolbar
            title={title}
            showCopyAll={kind === 'markdown' && Boolean(rawContent)}
            onCopyAll={() => {
              void copyText(rawContent, 'Full document');
            }}
            onRefresh={() => {
              void refreshWithStatus();
            }}
          />

          <section className="h-[calc(100%-57px)] overflow-auto p-4 lg:p-5">
            <MainArea
              selectedArtifact={selectedArtifact}
              sections={sections}
              parsedJson={parsedJson}
              kind={kind}
              rawContent={rawContent}
              onCopySection={(text, label) => {
                void copyText(text, label);
              }}
            />
          </section>
        </main>
      </div>

      {status ? <StatusToast message={status} /> : null}
    </>
  );
};
