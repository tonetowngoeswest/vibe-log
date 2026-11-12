import { z } from 'zod';

export const emailSchema = z.email().max(254).transform(value => value.toLowerCase().trim());
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128);
export const displayNameSchema = z.string().trim().min(2).max(60);
export const versionSchema = z.number().int().nonnegative();
export const uuidSchema = z.uuid();
export const storyDraftSchema = z.object({
  title: z.string().trim().min(1).max(240), dek: z.string().trim().min(1).max(1000),
  paragraphs: z.array(z.string().trim().min(1).max(20000)).min(1).max(200),
  paragraphLinks: z.array(z.object({ paragraph: z.number().int().nonnegative(), text: z.string().min(1).max(20000), url: z.url().startsWith('https://').max(2048) })).max(1000).default([]),
  expectedVersion: versionSchema,
}).superRefine((value, context) => {
  if (value.paragraphs.join('').length > 100000) context.addIssue({ code: 'custom', message: 'The story is too long.' });
  const occupied = new Map<number, [number, number][]>();
  for (const link of value.paragraphLinks) {
    const text = value.paragraphs[link.paragraph];
    const start = text?.indexOf(link.text) ?? -1;
    if (start < 0) { context.addIssue({ code: 'custom', message: 'Every attribution link must match text in its paragraph.' }); continue; }
    const end = start + link.text.length;
    const ranges = occupied.get(link.paragraph) || [];
    if (ranges.some(([a, b]) => start < b && a < end)) context.addIssue({ code: 'custom', message: 'Attribution links cannot overlap.' });
    ranges.push([start, end]); occupied.set(link.paragraph, ranges);
  }
});
export const slotsSchema = z.object({ leftTop: uuidSchema.nullable(), leftBottom: uuidSchema.nullable(), lead: uuidSchema.nullable(), latest1: uuidSchema.nullable(), latest2: uuidSchema.nullable(), latest3: uuidSchema.nullable(), latest4: uuidSchema.nullable() }).strict().superRefine((value, context) => {
  const ids = Object.values(value).filter(Boolean);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'A story can appear in only one homepage position.' });
});
export function safeReturnPath(value: unknown, fallback = '/account/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    if (new URL(value, 'https://return.invalid').origin !== 'https://return.invalid') return fallback;
  }
  catch { return fallback; }
  return value;
}
