"""Render the six static articles and keep homepage story links in sync.

Run from any directory with: python3 scripts/build_news.py
No dependencies or server-side runtime are required by GitHub Pages.
"""
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTICLES = json.loads((ROOT / 'news/articles.json').read_text())
home_path = ROOT / 'index.html'
home = home_path.read_text()


def e(value):
    return escape(str(value), quote=True)


# The homepage is the source for the shared site chrome and comments section.
header = re.search(r'<header class="site-header">.*?</header>', home, re.S).group()
header = header.replace('src="chiefs-logo.png"', 'src="../../chiefs-logo.png"')
header = header.replace('href="./"', 'href="../../"')
header = header.replace('aria-current="page"', 'aria-current="location"')
header = re.sub(r'href="#([^"]+)"', r'href="../../#\1"', header)
footer = re.search(r'<footer class="site-footer">.*?</footer>', home, re.S).group()
footer = footer.replace('href="./"', 'href="../../"')
comments = re.search(r'<section class="comments-section".*?</section>', home, re.S).group()

for article in ARTICLES:
    slug = article['slug']
    title = e(article['title'])
    target = f'news/{slug}/'
    pattern = rf'(<article\b[^>]*data-story="{re.escape(slug)}"[^>]*>)(.*?)(</article>)'

    def update_card(match):
        content = match[2]
        content = re.sub(r'<h([23])>.*?</h\1>', lambda m: f'<h{m[1]}><a href="{target}">{title}</a></h{m[1]}>', content, count=1, flags=re.S)
        content = re.sub(r'<p class="dek">.*?</p>', lambda m: f'<p class="dek">{e(article["dek"])}</p>', content, count=1, flags=re.S)
        content = re.sub(r'<p class="category">.*?</p>', lambda m: f'<p class="category">{e(article["category"])}</p>', content, count=1, flags=re.S)
        # Unwrap an existing image link before rendering, so reruns are idempotent.
        content = re.sub(r'<a class="story-photo-link"[^>]*>(<figure.*?</figure>)</a>', r'\1', content, flags=re.S)
        content = re.sub(r'(<figure.*?</figure>)', lambda m: f'<a class="story-photo-link" href="{target}" aria-label="Read: {title}">{m[1]}</a>', content, count=1, flags=re.S)
        return match[1] + content + match[3]

    home, count = re.subn(pattern, update_card, home, flags=re.S)
    if count != 1:
        raise ValueError(f'Expected one homepage card for {slug}; found {count}')

    paragraphs = []
    mapping = article.get('paragraphSources', [[] for _ in article['paragraphs']])
    for index, text in enumerate(article['paragraphs']):
        citations = ''.join(f'<sup><a href="#source-{i + 1}" aria-label="Source {i + 1}">[{i + 1}]</a></sup>' for i in mapping[index])
        paragraphs.append(f'          <p>{e(text)}{citations}</p>')
    sources = '\n'.join(f'            <li id="source-{i+1}"><a href="{e(source["url"])}">{e(source["title"])}</a></li>' for i, source in enumerate(article['sources']))
    related = [other for other in ARTICLES if other['slug'] != slug][:3]
    related_cards = '\n'.join(f'''          <article class="related-story">
            <a href="../{e(other['slug'])}/"><div class="related-image{' trim-image' if other['image']['trim'] else ''}"><img src="../../{e(other['image']['src'])}" alt="{e(other['image']['alt'])}" width="2048" height="1152" loading="lazy" /></div><p class="category">{e(other['category'])}</p><h3>{e(other['title'])}</h3></a>
            <p class="byline">Tony Hernandez</p>
          </article>''' for other in related)
    photo = article['image']
    read_minutes = max(1, round(article['wordCount'] / 200))
    page = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="{e(article['dek'])}" />
    <title>{title} | Chiefs News</title>
    <link rel="stylesheet" href="../../style.css" />
    <script src="../../theme.js" defer></script>
    <script src="../../script.js" defer></script>
    <script src="../../article.js" defer></script>
  </head>
  <body class="article-page">
    <a class="skip-link" href="#main">Skip to article</a>
    {header}
    <main class="article-main" id="main" tabindex="-1">
      <article aria-labelledby="article-title">
        <div class="article-heading">
          <a class="back-to-news" href="../../">← All news</a>
          <p class="category">{e(article['category'])}</p>
          <h1 id="article-title">{title}</h1>
          <p class="article-dek">{e(article['dek'])}</p>
        </div>
        <figure class="article-figure">
          <div class="article-image{' trim-image' if photo['trim'] else ''}"><img src="../../{e(photo['src'])}" alt="{e(photo['alt'])}" width="2048" height="1152" fetchpriority="high" /></div>
          <figcaption>{e(photo['caption'])}</figcaption>
        </figure>
        <div class="article-layout">
          <aside class="author-rail" aria-label="About the author">
            <span class="author-monogram" aria-hidden="true">TH</span>
            <p class="author-name">By {e(article['author'])}</p>
            <p class="author-role">Chiefs News contributor</p>
            <a href="../../#comments-heading">Join the conversation</a>
            <p class="author-note">Independent coverage.<br>Red and gold perspective.</p>
          </aside>
          <div class="article-copy">
            <div class="article-tools"><time datetime="{article['published']}">{e(article['dateLabel'])}</time><span>{read_minutes} min read</span><button type="button" id="copy-article-link" hidden>Copy link</button></div>
            <p id="article-status" role="status"></p>
            <div class="article-body">
{chr(10).join(paragraphs)}
            </div>
            <section class="article-sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Reporting &amp; sources</h2><ol>
{sources}
            </ol><p>Reporting reflects the linked sources available for this dated edition. Analysis is identified above.</p></section>
          </div>
        </div>
      </article>
      <section class="related-section" aria-labelledby="related-heading"><div class="section-heading"><h2 id="related-heading">More from Chiefs News</h2><a href="../../">All stories →</a></div><div class="related-grid">
{related_cards}
      </div></section>
    </main>
    {comments}
    {footer}
  </body>
</html>
'''
    directory = ROOT / 'news' / slug
    directory.mkdir(exist_ok=True)
    (directory / 'index.html').write_text(page)

home_path.write_text(home)
print(f'Rendered {len(ARTICLES)} articles and updated homepage links.')
