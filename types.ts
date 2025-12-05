
export interface SourcePrimary {
  text: string;
  section?: string;
  concept_focus?: string;
  author?: string;
  language?: string;
  note?: string;
  content?: string; // Actual text content for AI context
}

export interface SourceSecondary {
  author: string;
  works?: string[];
  focus: string;
  language?: string;
}

export interface SyllabusData {
  project_title: string;
  core_concept: string;
  primary_sources_en: SourcePrimary[];
  primary_sources_bn: SourcePrimary[];
  secondary_sources: SourceSecondary[];
  key_terms: string[];
  suggested_queries?: string[];
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64
  name?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  attachments?: Attachment[];
  translation?: {
    text: string;
    lang: string;
    active: boolean;
  };
}

export enum TabView {
  SYLLABUS = 'SYLLABUS',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS'
}

export type Theme = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type ThemeMode = 'dark' | 'light';

export interface SavedState {
  appName: string;
  persona: string;
  syllabusData: SyllabusData;
  messages: any[]; // Using any because Date objects need to be serialized/deserialized
  theme: Theme;
  mode: ThemeMode;
  lastUpdated: number;
}

export interface UserProfile {
  name: string;
  email: string;
  mobile: string;
  registeredAt: number;
}
