export type EditorialRole = 'reader' | 'editor' | 'admin';

export type AttributionLink = {
  paragraph: number;
  text: string;
  url: string;
};

export type EditableStory = {
  id: string;
  slug: string;
  title: string;
  dek: string;
  paragraphs: string[];
  paragraphLinks?: AttributionLink[];
  category: string;
  author: string;
  published: string;
  updated?: string;
  archived?: boolean;
  version: number;
  revision_id?: string;
  publishedRevisionId?: string | null;
  draftRevisionId?: string | null;
  hasUnpublishedChanges?: boolean;
  hasDraft?: boolean;
};

export type StoryHistoryEntry = { id: string; createdAt: string; createdBy?: string | null; published: boolean; content: EditableStory };

export const SLOT_DEFINITIONS = [
  { key: 'leftTop', label: 'Upper left', column: 'left' },
  { key: 'leftBottom', label: 'Lower left', column: 'left' },
  { key: 'lead', label: 'Center lead', column: 'lead' },
  { key: 'latest1', label: 'The Latest · 1', column: 'latest' },
  { key: 'latest2', label: 'The Latest · 2', column: 'latest' },
  { key: 'latest3', label: 'The Latest · 3', column: 'latest' },
  { key: 'latest4', label: 'The Latest · 4', column: 'latest' },
] as const;

export type SlotKey = (typeof SLOT_DEFINITIONS)[number]['key'];
export type EditorialLayout = {
  version: number;
  slots: Record<SlotKey, string | null>;
};

export type ManagedUser = {
  id: string;
  displayName: string;
  email?: string;
  role: EditorialRole;
  createdAt?: string;
};
