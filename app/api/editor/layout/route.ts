import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer, HttpError } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { slotsSchema, versionSchema } from '@/lib/validation';
import { getDraftLayout } from '@/lib/data';
export async function PATCH(request: Request) {
  return api(async () => {
    await requireViewer(['editor', 'admin']);
    const { slots, expectedVersion } = z.object({ slots: slotsSchema, expectedVersion: versionSchema }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('save_homepage_draft', { p_slots: slots, p_expected_version: expectedVersion });
    if (error) rpcError(error);
    const layout = await getDraftLayout();
    if (layout.version !== Number(data.version)) throw new HttpError(409, 'Your layout was saved, but another editor changed it immediately afterward. Review the latest version before continuing.');
    return json({ layout });
  });
}
