import 'server-only';
import { supabaseServer } from './supabase';
import { HttpError } from './auth';
import type { Comment, Viewer } from './types';
export async function threadId(slug: string) {
  if (slug === 'home') return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'Invalid discussion.');
  const client = await supabaseServer();
  const { data, error } = await client.from('published_stories').select('id').eq('slug', slug).maybeSingle();
  if (error) throw new HttpError(503, 'The discussion could not be loaded.');
  if (!data) throw new HttpError(404, 'Story not found.');
  return data.id as string;
}
export function presentComment(row: Record<string, any>, viewer: Viewer | null): Comment {
  const owner = row.user_id === viewer?.id;
  return { id: row.id, userId: row.user_id, displayName: row.display_name || (owner ? viewer?.displayName : 'Reader') || 'Reader', text: row.body, createdAt: row.created_at, updatedAt: row.updated_at, canEdit: Boolean(viewer && !viewer.mustChangePassword && owner), canDelete: Boolean(viewer && !viewer.mustChangePassword && (owner || viewer.role === 'editor' || viewer.role === 'admin')) };
}
