import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './auth';

export function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export async function readBody(request: Request) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  const allowed = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : ownOrigin;
  if (!origin || (origin !== ownOrigin && origin !== allowed)) throw new HttpError(403, 'This request must come from the website.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON content.');
  if (Number(request.headers.get('content-length') || 0) > 262144) throw new HttpError(413, 'This request is too large.');
  const text = await request.text();
  if (Buffer.byteLength(text) > 262144) throw new HttpError(413, 'This request is too large.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'The request contains invalid JSON.'); }
}
export function rpcError(error: { code?: string; message: string }) {
  const status = ({ '42501': 403, '40001': 409, '22023': 400, '22P02': 400, P0002: 404, P0001: 429 } as Record<string, number>)[error.code || ''] || 500;
  throw new HttpError(status, status === 500 ? 'The request could not be completed. Please try again.' : error.message);
}
export async function api(work: () => Promise<Response>) {
  try { return await work(); }
  catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: error.issues[0]?.message || 'Check the submitted fields.' }, 400);
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'The service is unavailable. Please try again.' }, 503);
  }
}
export function siteUrl(request: Request) {
  const url = process.env.SITE_URL || new URL(request.url).origin;
  return url.replace(/\/$/, '');
}
