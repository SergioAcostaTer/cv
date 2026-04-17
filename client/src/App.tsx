import { useCallback, useEffect, useMemo, useState } from 'react';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MainArea } from './components/MainArea';
import { MainToolbar } from './components/MainToolbar';
import { StatusToast } from './components/StatusToast';
import { useArtifactContent } from './hooks/useArtifactContent';
import { useLibrary } from './hooks/useLibrary';
import { useLibraryEvents } from './hooks/useLibraryEvents';
import type { Category, Selection, ViewSelection } from './types';

export const App = () => {
  const { library, signature, refreshLibrary } = useLibrary();
  const [selectedView, setSelectedView] = useState<ViewSelection | null>(null);
  const [status, setStatus] = useState('');

  const selectedArtifact: Selection | null = selectedView && selectedView !== 'chat' ? selectedView : null;
  const isChatSelected = selectedView === 'chat';

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
      setSelectedView(null);
      clearContent();
    }
  }, [signature, library, selectedArtifact, clearContent]);

  const onSelect = useCallback(
    (category: Category, index: number): void => {
      const item = library[category][index];
      if (!item) {
        return;
      }

      setSelectedView({ category, item });
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

  const title = useMemo(() => {
    if (selectedView === 'chat') {
      return 'Web Chat';
    }

    return selectedArtifact?.item.filename ?? 'Select an artifact from the sidebar';
  }, [selectedArtifact, selectedView]);

  return (
    <>
      <div className="grid h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
        <LibrarySidebar
          library={library}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onNewChat={() => {
            setSelectedView('chat');
            clearContent();
          }}
          isChatSelected={isChatSelected}
        />

        <main className="min-h-0 overflow-hidden border-t border-border bg-background md:border-t-0 md:border-l">
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

          <section className="h-[calc(100%-57px)] overflow-auto p-4 md:p-5">
            <MainArea
              selectedArtifact={selectedView}
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
