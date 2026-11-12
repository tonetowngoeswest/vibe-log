import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HomepageLayout, Story } from '../lib/types';
import { HomeContent } from '../components/public/HomeContent';
import { ArticleContent } from '../components/public/ArticleContent';
import { ArticleBody } from '../components/public/ArticleBody';
import { parseLegacyNotes } from '../components/public/legacy-notes';

const source = JSON.parse(readFileSync(new URL('../news/articles.json', import.meta.url), 'utf8')) as Story[];
const stories: Story[] = source.map((story, index) => ({ ...story, id: `story-${index}`, version: 1, revision_id: `revision-${index}` }));

function homepageLayout(): HomepageLayout {
  return { version: 1, slots: { leftTop: stories[0].id, leftBottom: stories[4].id, lead: stories[5].id, latest1: stories[1].id, latest2: stories[2].id, latest3: stories[6].id, latest4: stories[7].id } };
}

test('public homepage follows the seven saved slots rather than publication order', () => {
  const layout = homepageLayout();
  const html = renderToStaticMarkup(createElement(HomeContent, { stories, layout }));
  assert.match(html, new RegExp(`class="story" id="team" data-story="${stories[0].slug}"`));
  assert.match(html, new RegExp(`class="story" id="photos" data-story="${stories[4].slug}"`));
  assert.match(html, new RegExp(`class="lead-story" data-story="${stories[5].slug}"`));
  assert.equal((html.match(/class="latest-story"/g) || []).length, 4);
  const latestSlugs = [...html.matchAll(/class="latest-story"[^>]*data-story="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(latestSlugs, [stories[1].slug, stories[2].slug, stories[6].slug, stories[7].slug]);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
});

test('unfinished editor layout previews show empty slots without substituting stories', () => {
  const layout: HomepageLayout = { version: 2, slots: { leftTop: null, leftBottom: null, lead: null, latest1: null, latest2: null, latest3: null, latest4: null } };
  const html = renderToStaticMarkup(createElement(HomeContent, { stories, layout }));
  assert.equal((html.match(/class="empty-story-slot"/g) || []).length, 7);
  assert.equal((html.match(/data-story=/g) || []).length, 0);
});

test('inline attribution is linked and story copy is escaped as text', () => {
  const paragraph = 'Read the original report. <script>alert(1)</script> Another reference.';
  const html = renderToStaticMarkup(createElement(ArticleBody, { paragraphs: [paragraph], paragraphLinks: [
    { paragraph: 0, text: 'the original report', url: 'https://example.com/report?a=1&b=2' },
    { paragraph: 0, text: 'Another reference', url: 'javascript:alert(1)' },
  ] }));
  assert.match(html, /<a href="https:\/\/example.com\/report\?a=1&amp;b=2">the original report<\/a>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|javascript:|<sup/);
});

test('article render preserves title, dek, photo credit and archival context', () => {
  const original = stories.find(story => story.slug === 'mahomes-arm-injury-update')!;
  const story = { ...original, title: 'A revised headline', dek: 'The revised dek is visible here.', updated: '2026-11-13', dateLabel: 'Updated Nov. 13, 2026', archived: true };
  const html = renderToStaticMarkup(createElement(ArticleContent, { story, relatedStories: stories.filter(other => other.id !== story.id).slice(0, 3) }));
  assert.match(html, /<h1 id="article-title">A revised headline<\/h1>/);
  assert.match(html, /The revised dek is visible here\./);
  assert.ok(html.includes(story.image.src));
  assert.ok(html.includes(story.image.credit!));
  assert.ok(html.includes(story.image.sourceUrl!));
  assert.match(html, /From the archive\./);
  assert.match(html, /not currently featured on the homepage/);
  assert.doesNotMatch(html, /reflects reporting at its original publication date/);
  assert.match(html, /datetime="2026-11-13"/i);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
});

test('legacy export keeps private notes intact and exports only known fields', () => {
  const createdAt = '2026-11-08T12:00:00.000Z';
  assert.deepEqual(parseLegacyNotes(null), []);
  assert.deepEqual(parseLegacyNotes(JSON.stringify([{ id: 'one', text: '<private note>', createdAt, unexpected: 'discard me' }])), [{ id: 'one', text: '<private note>', createdAt }]);
  assert.throws(() => parseLegacyNotes('{broken'));
  assert.throws(() => parseLegacyNotes(JSON.stringify([{ id: 'one', text: 'note', createdAt: 'not-a-date' }])));
  assert.throws(() => parseLegacyNotes(JSON.stringify({ text: 'wrong shape' })));
});
