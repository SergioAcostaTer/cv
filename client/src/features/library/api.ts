import type { LibraryPayload } from '../../types';

export const fetchLibrary = async (): Promise<LibraryPayload> => {
  const response = await fetch('/api/library');
  if (!response.ok) {
    throw new Error('Could not load library');
  }

  return (await response.json()) as LibraryPayload;
};

export const fetchArtifactText = async (artifactPath: string): Promise<string> => {
  const response = await fetch(`/api/file?path=${encodeURIComponent(artifactPath)}`);
  if (!response.ok) {
    throw new Error('Could not load artifact');
  }

  return response.text();
};
