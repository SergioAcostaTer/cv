import { useEffect } from 'react';

export const useLibraryEvents = (onLibraryUpdated: () => void): void => {
  useEffect(() => {
    const events = new EventSource('/api/events');

    const handleLibraryUpdated = (): void => {
      onLibraryUpdated();
    };

    events.addEventListener('library-updated', handleLibraryUpdated);

    events.onerror = () => {
      events.close();
    };

    return () => {
      events.removeEventListener('library-updated', handleLibraryUpdated);
      events.close();
    };
  }, [onLibraryUpdated]);
};
