import { z } from 'zod';
import { api, json, readBody, rpcError } from '@/lib/http';
import { requireViewer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase';
import { uuidSchema } from '@/lib/validation';
export async function GET() {
  return api(async () => {
    await requireViewer(['admin']);
    const client = await supabaseServer();
    const { data, error } = await client.rpc('list_app_users');
    if (error) rpcError(error);
    return json({ users: (data || []).map((row: Record<string, unknown>) => ({ id: row.id, displayName: row.display_name, email: row.email, role: row.role, createdAt: row.created_at })) });
  });
}
export async function PATCH(request: Request) {
  return api(async () => {
    await requireViewer(['admin']);
    const role = z.enum(['reader', 'editor', 'admin']);
    const input = z.object({ userId: uuidSchema, role, expectedRole: role }).parse(await readBody(request));
    const client = await supabaseServer();
    const { data, error } = await client.rpc('set_user_role', { p_user_id: input.userId, p_role: input.role, p_expected_role: input.expectedRole });
    if (error) rpcError(error);
    return json({ user: data });
  });
}
