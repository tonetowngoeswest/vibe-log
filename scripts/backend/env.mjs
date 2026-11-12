import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export function loadLocalEnvironment() {
  // Existing environment variables take precedence; local credentials stay untracked.
  for (const name of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), name);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

export function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running this command.`);
  return value;
}

export function adminClient() {
  loadLocalEnvironment();
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)) {
    throw new Error('Use an HTTPS Supabase URL, or a local Supabase URL.');
  }
  return createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function rpc(client, name, values = {}) {
  const { data, error } = await client.rpc(name, values);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}
