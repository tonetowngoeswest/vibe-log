import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { displayNameSchema } from '@/lib/validation';
export async function PATCH(request: Request) {
  return api(async () => {
    await requireViewer();
    const { displayName } = z.object({ displayName: displayNameSchema }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('update_display_name', { p_display_name: displayName });
    if (error) rpcError(error);
    return json({ profile: data });
  });
}
