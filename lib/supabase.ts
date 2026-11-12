import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function backendConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('The backend is not configured. Follow docs/BACKEND_SETUP.md to enable accounts and publishing.');
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => {
        try { for (const { name, value, options } of values) store.set(name, value, options); }
        catch { /* Server components cannot set cookies; proxy refreshes the session. */ }
      },
    },
  });
}
