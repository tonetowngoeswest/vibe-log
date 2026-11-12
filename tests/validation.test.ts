import assert from 'node:assert/strict';
import test from 'node:test';
import { safeReturnPath, storyDraftSchema, slotsSchema } from '../lib/validation';

test('login return paths cannot leave the app, including encoded separators', () => {
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/%5cevil.example', '/%0aevil', '/\t/evil.example', '/%09/evil.example', '/%00evil', '/%7fevil', '%E0%A4%A']) assert.equal(safeReturnPath(path), '/account/');
  assert.equal(safeReturnPath('/news/josh-downs-chiefs-offense/#comments-heading'), '/news/josh-downs-chiefs-offense/#comments-heading');
});
test('story attribution validation rejects missing, unsafe and overlapping links', () => {
  const draft = { title: 'A headline', dek: 'A dek', paragraphs: ['Official reporting describes the update.'], paragraphLinks: [{ paragraph: 0, text: 'Official reporting', url: 'https://example.com/report' }], expectedVersion: 1 };
  assert.equal(storyDraftSchema.safeParse(draft).success, true);
  assert.equal(storyDraftSchema.safeParse({ ...draft, paragraphLinks: [{ ...draft.paragraphLinks[0], text: 'Missing phrase' }] }).success, false);
  assert.equal(storyDraftSchema.safeParse({ ...draft, paragraphLinks: [{ ...draft.paragraphLinks[0], url: 'javascript:alert(1)' }] }).success, false);
  assert.equal(storyDraftSchema.safeParse({ ...draft, paragraphLinks: [...draft.paragraphLinks, { paragraph: 0, text: 'reporting describes', url: 'https://example.com/other' }] }).success, false);
});
test('draft layouts allow empty slots but reject duplicates and unknown slot names', () => {
  const empty = { leftTop: null, leftBottom: null, lead: null, latest1: null, latest2: null, latest3: null, latest4: null };
  assert.equal(slotsSchema.safeParse(empty).success, true);
  const id = 'b2d70b5e-fc02-4e40-84e3-aed694697feb';
  assert.equal(slotsSchema.safeParse({ ...empty, leftTop: id, lead: id }).success, false);
  assert.equal(slotsSchema.safeParse({ ...empty, center: null }).success, false);
});
