import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { safeReturnPath } from '@/lib/validation';
import { siteUrl } from '@/lib/http';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeReturnPath(url.searchParams.get('next'));
  if (code) {
    const client = await supabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, siteUrl(request)));
  }
  return NextResponse.redirect(new URL('/login/?error=verification', siteUrl(request)));
}
