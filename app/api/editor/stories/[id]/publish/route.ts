import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer, HttpError } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { versionSchema, uuidSchema } from '@/lib/validation';
import { getEditorStories } from '@/lib/data';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await requireViewer(['editor', 'admin']);
    const id = uuidSchema.parse((await context.params).id);
    const { expectedVersion } = z.object({ expectedVersion: versionSchema }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('publish_story', { p_story_id: id, p_expected_version: expectedVersion });
    if (error) rpcError(error);
    const story = (await getEditorStories()).find(row => row.id === id);
    if (!story || story.version !== Number(data.version)) throw new HttpError(409, 'Your story was published, but another editor changed it immediately afterward. Review the latest version before continuing.');
    return json({ story });
  });
}
