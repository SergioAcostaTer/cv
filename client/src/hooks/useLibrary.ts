import { useEffect, useMemo, useState } from 'react';
import { fetchLibrary } from '../features/library/api';
import { buildLibrarySignature } from '../features/library/markdown';
import { emptyLibrary, type LibraryPayload } from '../types';

export const useLibrary = (): {
  library: LibraryPayload;
  signature: string;
  refreshLibrary: () => Promise<void>;
} => {
  const [library, setLibrary] = useState<LibraryPayload>(emptyLibrary);

  const refreshLibrary = async (): Promise<void> => {
    const payload = await fetchLibrary();
    setLibrary(payload);
  };

  useEffect(() => {
    void refreshLibrary();
  }, []);

  const signature = useMemo(() => buildLibrarySignature(library), [library]);

  return {
    library,
    signature,
    refreshLibrary
  };
};
