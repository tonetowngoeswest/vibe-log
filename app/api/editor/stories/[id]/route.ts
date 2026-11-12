import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer, HttpError } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { storyDraftSchema, uuidSchema } from '@/lib/validation';
import { getEditorStories } from '@/lib/data';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await requireViewer(['editor', 'admin']);
    const id = uuidSchema.parse((await context.params).id);
    const input = storyDraftSchema.parse(await readBody(request));
    const client = await supabaseServer();
    const { expectedVersion, ...content } = input;
    const { data, error } = await client.rpc('save_story_draft', { p_story_id: id, p_content: content, p_expected_version: expectedVersion });
    if (error) rpcError(error);
    const story = (await getEditorStories()).find(row => row.id === id);
    if (!story) throw new HttpError(404, 'Story not found.');
    if (story.version !== Number(data.version)) throw new HttpError(409, 'Your draft was saved, but another editor changed the story immediately afterward. Review the latest version before continuing.');
    return json({ story });
  });
}
