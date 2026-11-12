import 'server-only';
import { cache } from 'react';
import legacy from '@/news/articles.json';
import { backendConfigured, supabaseServer } from './supabase';
import { requireViewer, HttpError } from './auth';
import type { Story, HomepageLayout } from './types';

function orderStories(stories: Story[]) {
  return [...stories].sort((a, b) => (b.updated || b.published).localeCompare(a.updated || a.published));
}

export const getPublishedStories = cache(async (): Promise<Story[]> => {
  if (!backendConfigured()) return orderStories(legacy.map(story => ({ ...story, paragraphLinks: story.paragraphLinks || [], id: story.slug, version: 0, revision_id: 'legacy' })) as Story[]);
  const client = await supabaseServer();
  const { data, error } = await client.from('published_stories').select('*');
  if (error) throw new Error('Published stories could not be loaded. Please try again.');
  return orderStories((data || []).map(row => ({ ...row.content, id: row.id, slug: row.slug, revision_id: row.revision_id, version: 0 })));
});

export async function getPublishedStory(slug: string) { return (await getPublishedStories()).find(story => story.slug === slug) || null; }

export const getPublishedLayout = cache(async (): Promise<HomepageLayout | null> => {
  if (!backendConfigured()) {
    const supporting = legacy.filter(story => story.homepage === 'supporting');
    const lead = legacy.find(story => story.homepage === 'lead');
    const latest = orderStories(legacy.map(story => ({ ...story, id: story.slug })) as Story[]).filter(story => !story.homepage && !story.archived).slice(0, 4);
    return { version: 0, slots: { leftTop: supporting[0]?.slug || null, leftBottom: supporting[1]?.slug || null, lead: lead?.slug || null, latest1: latest[0]?.slug || null, latest2: latest[1]?.slug || null, latest3: latest[2]?.slug || null, latest4: latest[3]?.slug || null } };
  }
  const client = await supabaseServer();
  const { data, error } = await client.from('published_homepage').select('*').maybeSingle();
  if (error) throw new Error('The homepage could not be loaded. Please try again.');
  return data ? { version: Number(data.version), slots: data.slots } : null;
});

export async function getEditorStories(): Promise<Story[]> {
  await requireViewer(['editor', 'admin']);
  const client = await supabaseServer();
  const { data, error } = await client.rpc('get_editor_stories');
  if (error) throw new HttpError(500, 'The story drafts could not be loaded. Please try again.');
  const layout = await getPublishedLayout();
  const featured = new Set(Object.values(layout?.slots || {}));
  return (data || []).map((row: Record<string, any>) => ({ ...(row.draft_content || row.published_content), archived: !featured.has(row.id), id: row.id, slug: row.slug, version: Number(row.version), revision_id: row.draft_revision_id || row.published_revision_id, publishedRevisionId: row.published_revision_id, draftRevisionId: row.draft_revision_id, hasDraft: Boolean(row.draft_revision_id && row.draft_revision_id !== row.published_revision_id) }));
}

export async function getDraftLayout(): Promise<HomepageLayout> {
  await requireViewer(['editor', 'admin']);
  const client = await supabaseServer();
  const { data, error } = await client.rpc('get_editor_layout');
  if (error || !data) throw new HttpError(500, 'The draft layout could not be loaded. Please try again.');
  return { version: Number(data.version), slots: data.draft_slots || data.published_slots };
}

export async function getStoryHistory(id: string) {
  await requireViewer(['editor', 'admin']);
  const client = await supabaseServer();
  const { data, error } = await client.rpc('get_story_history', { p_story_id: id });
  if (error) throw new HttpError(500, 'Revision history could not be loaded. Please try again.');
  return (data || []).map((row: Record<string, any>) => ({ id: row.id, createdAt: row.created_at, createdBy: row.created_by, published: row.published, content: { ...row.content, id, version: 0 } }));
}
