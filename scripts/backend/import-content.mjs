import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { adminClient, rpc } from './env.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function legacyLayout(articles) {
  if (!Array.isArray(articles) || !articles.length) throw new Error('Expected the legacy article array.');
  const slugs = articles.map(article => article.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('Article slugs must be unique.');
  for (const article of articles) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) || !article.title || !article.dek || !Array.isArray(article.paragraphs)) {
      throw new Error(`Invalid legacy story: ${article.slug ?? '(missing slug)'}`);
    }
    for (const link of article.paragraphLinks ?? []) {
      if (!Number.isInteger(link.paragraph) || !article.paragraphs[link.paragraph]?.includes(link.text) || !/^https:\/\//.test(link.url)) {
        throw new Error(`Invalid attribution in ${article.slug}.`);
      }
    }
  }
  const supporting = articles.filter(article => article.homepage === 'supporting');
  const lead = articles.filter(article => article.homepage === 'lead');
  const latest = [...articles].sort((a, b) => (b.updated ?? b.published).localeCompare(a.updated ?? a.published))
    .filter(article => !article.archived && !article.homepage).slice(0, 4);
  if (supporting.length !== 2 || lead.length !== 1 || latest.length !== 4) throw new Error('The legacy homepage needs two left stories, one lead and four Latest stories.');
  return {
    leftTop: supporting[0].slug, leftBottom: supporting[1].slug, lead: lead[0].slug,
    ...Object.fromEntries(latest.map((article, index) => [`latest${index + 1}`, article.slug])),
  };
}

export async function importContent() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const path = fileIndex >= 0 ? resolve(args[fileIndex + 1] ?? '') : resolve(root, 'news/articles.json');
  const articles = JSON.parse(await readFile(path, 'utf8'));
  const layout = legacyLayout(articles);
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ stories: articles.length, homepage: layout }, null, 2));
    return;
  }
  const result = await rpc(adminClient(), 'import_legacy_content', { p_articles: articles, p_slots_by_slug: layout });
  console.log(`Imported ${result.imported} stories; ${result.total} stories are stored. Existing content and any published layout were retained.`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  importContent().catch(error => { console.error(error.message); process.exitCode = 1; });
}
