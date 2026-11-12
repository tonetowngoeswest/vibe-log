export type Role = 'reader' | 'editor' | 'admin';
export type Viewer = { id: string; email?: string; displayName: string; role: Role; mustChangePassword: boolean };
export type ParagraphLink = { paragraph: number; text: string; url: string };
export type StoryImage = { src: string; alt: string; caption: string; trim: boolean; width?: number; height?: number; portrait?: boolean; credit?: string; sourceUrl?: string; downloadUrl?: string };
export type Story = {
  id: string; slug: string; title: string; dek: string; category: string; dateLabel: string;
  paragraphs: string[]; paragraphLinks: ParagraphLink[]; image: StoryImage; author: string;
  published: string; updated?: string; archived?: boolean; homepage?: string; wordCount: number;
  sources?: { title: string; url: string }[]; sourceNotes?: string;
  version: number; revision_id: string; publishedRevisionId?: string; draftRevisionId?: string; hasDraft?: boolean;
};
export const slotKeys = ['leftTop', 'leftBottom', 'lead', 'latest1', 'latest2', 'latest3', 'latest4'] as const;
export type SlotKey = typeof slotKeys[number];
export type HomepageLayout = { version: number; slots: Record<SlotKey, string | null> };
export type Comment = { id: string; userId: string; displayName: string; text: string; createdAt: string; updatedAt: string; canEdit: boolean; canDelete: boolean };
