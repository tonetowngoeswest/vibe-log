import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { presentComment } from '@/lib/comments';
import { uuidSchema } from '@/lib/validation';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const viewer = await requireViewer();
    const id = uuidSchema.parse((await context.params).id);
    const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('update_comment', { p_comment_id: id, p_body: text });
    if (error) rpcError(error);
    return json({ comment: presentComment(data, viewer) });
  });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await requireViewer();
    await readBody(request);
    const id = uuidSchema.parse((await context.params).id);
    const client = await supabaseServer();
    const { error } = await client.rpc('delete_comment', { p_comment_id: id });
    if (error) rpcError(error);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
  });
}
