import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, { cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' }, cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: values => {
      for (const { name, value } of values) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of values) response.cookies.set(name, value, options);
    },
  } });
  try { await client.auth.getClaims(); } catch { /* Pages and APIs enforce their own verified access checks. */ }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|Images/|chiefs-logo.png|favicon.ico).*)'] };
