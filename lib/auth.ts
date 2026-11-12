import 'server-only';
import { cache } from 'react';
import { backendConfigured, supabaseServer } from './supabase';
import type { Role, Viewer } from './types';

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!backendConfigured()) return null;
  const client = await supabaseServer();
  const { data: claims, error } = await client.auth.getClaims();
  if (error || !claims?.claims?.sub) return null;
  const { data, error: profileError } = await client.rpc('get_current_profile');
  if (profileError) throw new Error('Your account could not be loaded. Please try again.');
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) return null;
  return { id: profile.id, email: claims.claims.email as string | undefined, displayName: profile.display_name, role: profile.role as Role, mustChangePassword: profile.must_change_password };
});

export async function requireViewer(roles?: Role[], allowPasswordChange = false) {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError(401, 'Please sign in to continue.');
  if (roles && !roles.includes(viewer.role)) throw new HttpError(403, 'You do not have permission to do that.');
  if (!allowPasswordChange && viewer.mustChangePassword) throw new HttpError(403, 'Change your initial password from your account page before continuing.');
  return viewer;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
