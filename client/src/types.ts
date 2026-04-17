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

export type ViewSelection = Selection | 'chat';

export type MarkdownSection = {
  title: string;
  markdown: string;
};

export type ArtifactKind = 'pdf' | 'linkedin-json' | 'resume-json' | 'json' | 'unknown';

export type ResumeJson = {
  sectionLabels?: Record<string, string>;
  labels?: Record<string, string>;
  basics?: {
    name?: string;
    label?: string;
    email?: string;
    phone?: string;
    summary?: string;
    location?: {
      city?: string;
      region?: string;
      countryCode?: string;
    };
    profiles?: Array<{
      network?: string;
      username?: string;
      url?: string;
    }>;
  };
  work?: Array<{
    name?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    institution?: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: Array<{
    name?: string;
    keywords?: string[];
  }>;
  languages?: Array<{
    language?: string;
    fluency?: string;
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    highlights?: string[];
    url?: string;
  }>;
};

export type LinkedinLanguageProfile = {
  profile?: {
    fullName?: string;
    headline?: string;
    location?: string;
    industry?: string;
    customUrlSlug?: string;
    openToWork?: string[];
  };
  about?: {
    short?: string;
    long?: string;
    descriptionToPaste?: string;
    valueProposition?: string;
    callToAction?: string;
  };
  experience?: Array<{
    title?: string;
    company?: string;
    employmentType?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    techContext?: string[];
    achievements?: string[];
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    highlights?: string[];
    url?: string;
  }>;
  skills?: {
    top?: string[];
    byCategory?: Array<{
      category?: string;
      items?: string[];
    }>;
    keywords?: string[];
  };
  languages?: Array<{
    name?: string;
    proficiency?: string;
  }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    date?: string;
  }>;
};

export type LinkedinJson = {
  meta?: Record<string, unknown>;
  profile?: {
    en?: LinkedinLanguageProfile;
    es?: LinkedinLanguageProfile;
    [key: string]: LinkedinLanguageProfile | undefined;
  };
};

export const emptyLibrary = (): LibraryPayload => ({
  resumes: [],
  linkedinDrafts: [],
  roadmaps: []
});
