import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Generates a separate deploy directory; never rewrites the current Pages site.
const [target, output] = process.argv.slice(2);
if (!target || !output) throw new Error('Usage: node scripts/prepare-legacy-redirects.mjs https://new-site.example /absolute/output-directory');
const origin = new URL(target);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Use the new HTTPS site origin without a path, query or fragment.');
const root = resolve(import.meta.dirname, '..');
const directory = resolve(output);
if (directory === root || directory.startsWith(root + '/')) throw new Error('Use a separate output directory outside the repository.');
const stories = JSON.parse(await readFile(join(root, 'news/articles.json'), 'utf8'));
const paths = ['', 'news', ...stories.map(story => `news/${story.slug}`)];
for (const path of paths) {
  const url = new URL(path ? `${path}/` : '/', origin).href;
  const destination = join(directory, path); await mkdir(destination, { recursive: true });
  const escaped = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const prefix = path ? '../'.repeat(path.split('/').length) : '';
  await writeFile(join(destination, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="${escaped}"><meta http-equiv="refresh" content="3;url=${escaped}"><title>Chiefs News has moved</title></head><body><main><h1>Chiefs News has moved</h1><p><a href="${escaped}">Continue to this page on the new site</a></p><p>Original browser notes stay private. <a href="${prefix}export-comments.html">Export your saved notes</a> before leaving.</p></main></body></html>`);
}
await copyFile(join(root, 'export-comments.html'), join(directory, 'export-comments.html'));
await copyFile(join(root, 'legacy-export.js'), join(directory, 'legacy-export.js'));
await copyFile(join(root, 'style.css'), join(directory, 'style.css'));
console.log(`Prepared ${paths.length} redirects and a private notes exporter in the separate output directory.`);
