import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer, HttpError } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { versionSchema } from '@/lib/validation';
import { getDraftLayout } from '@/lib/data';
export async function POST(request: Request) {
  return api(async () => {
    await requireViewer(['editor', 'admin']);
    const { expectedVersion } = z.object({ expectedVersion: versionSchema }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('publish_homepage', { p_expected_version: expectedVersion });
    if (error) rpcError(error);
    const layout = await getDraftLayout();
    if (layout.version !== Number(data.version)) throw new HttpError(409, 'Your layout was published, but another editor changed it immediately afterward. Review the latest version before continuing.');
    return json({ layout });
  });
}
