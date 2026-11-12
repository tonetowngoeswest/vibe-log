import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { safeReturnPath } from '@/lib/validation';
import { siteUrl } from '@/lib/http';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (token_hash && (type === 'email' || type === 'recovery')) {
    const client = await supabaseServer();
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(safeReturnPath(url.searchParams.get('next'), type === 'recovery' ? '/reset-password/' : '/account/'), siteUrl(request)));
  }
  return NextResponse.redirect(new URL('/login/?error=verification', siteUrl(request)));
}
