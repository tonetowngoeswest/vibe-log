import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('cutover generation preserves story routes and private notes exports without editing the live static site', async () => {
  const output = await mkdtemp(join(tmpdir(), 'chiefs-redirect-test-'));
  const original = await readFile('index.html', 'utf8');
  try {
    execFileSync(process.execPath, ['scripts/prepare-legacy-redirects.mjs', 'https://news.example', output], { stdio: 'pipe' });
    const articles = JSON.parse(await readFile('news/articles.json', 'utf8'));
    const paths = ['', 'news', ...articles.map((article: { slug: string }) => `news/${article.slug}`)];
    for (const path of paths) {
      const html = await readFile(join(output, path, 'index.html'), 'utf8');
      assert.ok(html.includes(`href="https://news.example/${path ? path + '/' : ''}"`));
      const exporter = html.match(/href="([^"]*export-comments.html)"/)?.[1];
      assert.ok(exporter);
      assert.equal(resolve(output, path, exporter!), join(output, 'export-comments.html'));
    }
    assert.equal(await readFile('index.html', 'utf8'), original);
    assert.ok((await readFile(join(output, 'legacy-export.js'), 'utf8')).includes('vibe-log-entries'));
    assert.throws(() => execFileSync(process.execPath, ['scripts/prepare-legacy-redirects.mjs', 'http://news.example', output], { stdio: 'pipe' }));
    assert.throws(() => execFileSync(process.execPath, ['scripts/prepare-legacy-redirects.mjs', 'https://news.example', resolve('news')], { stdio: 'pipe' }));
  } finally { await rm(output, { recursive: true, force: true }); }
});
