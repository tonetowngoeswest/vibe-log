import { z } from 'zod';
import { api, json, readBody, siteUrl } from '@/lib/http';
import { supabaseServer } from '@/lib/supabase';
import { getViewer, requireViewer, HttpError } from '@/lib/auth';
import { displayNameSchema, emailSchema, passwordSchema, safeReturnPath } from '@/lib/validation';

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return api(async () => {
    const { action } = await context.params;
    const body = await readBody(request);
    const client = await supabaseServer();
    if (action === 'login') {
      const input = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(128), next: z.string().optional() }).parse(body);
      let email = input.identifier;
      if (email.toLowerCase() === 'admin') {
        if (!process.env.BOOTSTRAP_ADMIN_EMAIL) throw new HttpError(503, 'Administrator login has not been configured.');
        email = process.env.BOOTSTRAP_ADMIN_EMAIL;
      }
      email = emailSchema.parse(email);
      const { error } = await client.auth.signInWithPassword({ email, password: input.password });
      if (error) throw new HttpError(error.status === 429 ? 429 : 401, error.status === 429 ? 'Too many login attempts. Please wait and try again.' : 'The email or password is incorrect, or the email has not been verified.');
      const viewer = await getViewer();
      return json({ redirectTo: viewer?.mustChangePassword ? '/reset-password/' : safeReturnPath(input.next, viewer?.role === 'editor' || viewer?.role === 'admin' ? '/editor/' : '/account/') });
    }
    if (action === 'signup') {
      const input = z.object({ email: emailSchema, password: passwordSchema, displayName: displayNameSchema }).parse(body);
      if (['admin', 'administrator', 'system'].includes(input.displayName.toLowerCase())) throw new HttpError(400, 'Choose a display name other than Admin, Administrator or System.');
      const { error } = await client.auth.signUp({ email: input.email, password: input.password, options: { data: { display_name: input.displayName }, emailRedirectTo: `${siteUrl(request)}/auth/callback/?next=/account/` } });
      if (error) throw new HttpError(error.status === 429 ? 429 : 400, error.status === 429 ? 'Please wait before requesting another verification email.' : 'Signup could not be completed. Please try again or use password recovery for an existing account.');
      return json({ message: 'Check your email to verify your account before logging in.' });
    }
    if (action === 'logout') {
      const { error } = await client.auth.signOut();
      if (error) throw new HttpError(503, 'Logout could not be completed. Please try again.');
      return json({ redirectTo: '/' });
    }
    if (action === 'forgot-password') {
      const { email } = z.object({ email: emailSchema }).parse(body);
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl(request)}/auth/callback/?next=/reset-password/` });
      if (error) throw new HttpError(error.status === 429 ? 429 : 503, 'A reset email could not be requested. Please wait and try again.');
      return json({ message: 'If that address has an account, a password reset link is on its way.' });
    }
    if (action === 'reset-password') {
      await requireViewer(undefined, true);
      const { password } = z.object({ password: passwordSchema }).parse(body);
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new HttpError(400, 'The password could not be changed. Use a new password or request another reset link.');
      const { error: completionError } = await client.rpc('complete_password_change');
      if (completionError) throw new HttpError(503, 'Your password changed, but account setup could not finish. Sign in with your new password and try again.');
      return json({ redirectTo: '/account/' });
    }
    throw new HttpError(404, 'This account action was not found.');
  });
}
