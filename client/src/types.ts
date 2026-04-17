export type Artifact = {
  filename: string;
  path: string;
  modifiedAt: number;
};

export type LibraryPayload = {
  resumes: Artifact[];
  linkedinDrafts: Artifact[];
  roadmaps: Artifact[];
};

export type Category = keyof LibraryPayload;

export type Selection = {
  category: Category;
  item: Artifact;
};

export type MarkdownSection = {
  title: string;
  markdown: string;
};

export const emptyLibrary = (): LibraryPayload => ({
  resumes: [],
  linkedinDrafts: [],
  roadmaps: []
});
