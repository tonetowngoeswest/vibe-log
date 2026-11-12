import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer, getViewer, HttpError } from '@/lib/auth';
import { supabaseServer, backendConfigured } from '@/lib/supabase';
import { presentComment, threadId } from '@/lib/comments';
import { uuidSchema } from '@/lib/validation';
export async function GET(request: Request) {
  return api(async () => {
    if (!backendConfigured()) throw new HttpError(503, 'Shared comments will be available once the backend is configured.');
    const query = new URL(request.url).searchParams;
    const id = await threadId(query.get('story') || 'home');
    let cursor: { time: string; id: string } | undefined;
    if (query.get('cursor')) {
      try { cursor = z.object({ time: z.iso.datetime({ offset: true }), id: uuidSchema }).parse(JSON.parse(Buffer.from(query.get('cursor')!, 'base64url').toString())); }
      catch { throw new HttpError(400, 'Invalid comment page. Refresh the discussion.'); }
    }
    const viewer = await getViewer();
    const client = await supabaseServer();
    const { data, error } = await client.rpc('list_comments', { p_story_id: id, p_limit: 21, p_before: cursor?.time || null, p_before_id: cursor?.id || null });
    if (error) rpcError(error);
    const rows = (data || []).slice(0, 20);
    const last = rows.at(-1);
    const nextCursor = data?.length > 20 && last ? Buffer.from(JSON.stringify({ time: last.created_at, id: last.id })).toString('base64url') : null;
    return json({ comments: rows.map((row: Record<string, any>) => presentComment(row, viewer)), nextCursor });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const viewer = await requireViewer();
    const { story, text } = z.object({ story: z.string().min(1).max(240), text: z.string().trim().min(1).max(2000) }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('create_comment', { p_story_id: await threadId(story), p_body: text });
    if (error) rpcError(error);
    return json({ comment: presentComment(data, viewer) }, 201);
  });
}
