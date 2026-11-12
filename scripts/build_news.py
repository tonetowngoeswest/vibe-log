"""Render the static articles and keep homepage story links in sync.

Run from any directory with: python3 scripts/build_news.py
No dependencies or server-side runtime are required by GitHub Pages.
"""
import json
import re
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTICLES = json.loads((ROOT / 'news/articles.json').read_text())
LATEST_LIMIT = 4
if len({article['slug'] for article in ARTICLES}) != len(ARTICLES):
    raise ValueError('Article slugs must be unique')
for article in ARTICLES:
    date.fromisoformat(article['published'])
    date.fromisoformat(article.get('updated', article['published']))
    if article.get('homepage') not in (None, 'lead', 'supporting'):
        raise ValueError(f"Unknown homepage placement for {article['slug']}")
    if article.get('archived') and article.get('homepage'):
        raise ValueError(f"An archived article cannot be featured: {article['slug']}")
ORDERED_ARTICLES = sorted(ARTICLES, key=lambda article: article.get('updated', article['published']), reverse=True)
ACTIVE_ARTICLES = [article for article in ORDERED_ARTICLES if not article.get('archived')]
LATEST_ARTICLES = [article for article in ACTIVE_ARTICLES if not article.get('homepage')][:LATEST_LIMIT]
SUPPORTING_ARTICLES = [article for article in ARTICLES if article.get('homepage') == 'supporting']
LEAD_ARTICLES = [article for article in ARTICLES if article.get('homepage') == 'lead']
if len(SUPPORTING_ARTICLES) != 2 or len(LEAD_ARTICLES) != 1:
    raise ValueError('The homepage needs two supporting stories and one lead story')
home_path = ROOT / 'index.html'
home = home_path.read_text()


def e(value):
    return escape(str(value), quote=True)


# The homepage is the source for the shared site chrome and comments section.
home_header = re.search(r'<header class="site-header">.*?</header>', home, re.S).group()
home_footer = re.search(r'<footer class="site-footer">.*?</footer>', home, re.S).group()


def relocate(markup, prefix, home_fragments=False):
    def replace_url(match):
        attribute, url = match.groups()
        if url.startswith('#'):
            url = prefix + url if home_fragments else url
        elif not url.startswith(('https://', 'http://')):
            url = prefix if url == './' else prefix + url
        return f'{attribute}="{url}"'
    return re.sub(r'(src|href)="([^"]+)"', replace_url, markup)


header = relocate(home_header, '../../', home_fragments=True)
header = header.replace('aria-current="page"', 'aria-current="location"')
footer = relocate(home_footer, '../../')
comments = re.search(r'<section class="comments-section".*?</section>', home, re.S).group()


def story_card(article, prefix='', archive=False):
    photo = article['image']
    target = f'{prefix}news/{e(article["slug"])}/'
    classes = 'archive-story' if archive else 'latest-story'
    heading = 'h2' if archive else 'h3'
    image_class = 'archive-image' if archive else 'latest-image'
    image_class += ' portrait-thumbnail' if photo.get('portrait') else ''
    image_class += ' trim-image' if photo.get('trim') else ''
    return f'''          <article class="{classes}" data-story="{e(article['slug'])}">
            <a class="story-photo-link" href="{target}" aria-label="Read: {e(article['title'])}"><figure class="story-image {image_class}"><img src="{prefix}{e(photo['src'])}" alt="{e(photo['alt'])}" width="{photo.get('width', 2048)}" height="{photo.get('height', 1152)}" loading="lazy" /></figure></a>
            <div class="story-summary"><p class="category">{e(article['category'])}</p>
            <{heading}><a href="{target}">{e(article['title'])}</a></{heading}>
            <p class="dek">{e(article['dek'])}</p>
            <p class="byline">{e(article['author'])} <span aria-hidden="true">·</span> <time datetime="{article.get('updated', article['published'])}">{e(article['dateLabel'])}</time></p></div>
          </article>'''


def featured_card(article, anchor=None, lead=False):
    photo = article['image']
    title = e(article['title'])
    target = f'news/{e(article["slug"])}/'
    css_class = 'lead-story' if lead else 'story'
    anchor_attribute = f' id="{e(anchor)}"' if anchor else ''
    image_class = 'story-image lead-image' if lead else 'story-image'
    image_class += ' trim-image' if photo.get('trim') else ''
    image_class += ' portrait-thumbnail' if photo.get('portrait') else ''
    image_loading = 'fetchpriority="high"' if lead else 'loading="lazy"'
    caption = f'<figcaption>{e(article["category"])}</figcaption>' if lead else ''
    rule = '\n            <span class="story-rule" aria-hidden="true"></span>' if lead else ''
    return f'''          <article class="{css_class}"{anchor_attribute} data-story="{e(article['slug'])}">
            <a class="story-photo-link" href="{target}" aria-label="Read: {title}"><figure class="{image_class}"><img src="{e(photo['src'])}" alt="{e(photo['alt'])}" width="{photo.get('width', 2048)}" height="{photo.get('height', 1152)}" {image_loading} />{caption}</figure></a>
            <p class="category">{e(article['category'])}</p>
            <h2><a href="{target}">{title}</a></h2>
            <p class="dek">{e(article['dek'])}</p>
            <p class="byline">{e(article['author'])}</p>{rule}
          </article>'''


def render_home_section(name, content):
    global home
    pattern = rf'<!-- {name}:start -->.*?<!-- {name}:end -->'
    home, count = re.subn(pattern, lambda match: f'<!-- {name}:start -->\n{content}\n          <!-- {name}:end -->', home, flags=re.S)
    if count != 1:
        raise ValueError(f'Expected one generated {name} section')


render_home_section('supporting-stories', '\n'.join(featured_card(article, anchor=anchor) for article, anchor in zip(SUPPORTING_ARTICLES, ('team', 'photos'))))
render_home_section('lead-story', featured_card(LEAD_ARTICLES[0], lead=True))
render_home_section('latest-stories', '\n'.join(story_card(article) for article in LATEST_ARTICLES))

for article in ARTICLES:
    slug = article['slug']
    title = e(article['title'])
    paragraphs = []
    for index, text in enumerate(article['paragraphs']):
        links = [link for link in article.get('paragraphLinks', []) if link['paragraph'] == index]
        # Escape all copy and allow only declared, exact-text attribution links.
        spans = []
        for link in links:
            position = text.find(link['text'])
            if position < 0:
                raise ValueError(f"Missing attribution phrase in {slug}: {link['text']}")
            if not link['url'].startswith('https://'):
                raise ValueError(f'Expected an HTTPS reporting link in {slug}')
            spans.append((position, position + len(link['text']), link['url']))
        rendered = ''
        cursor = 0
        for begin, end, url in sorted(spans):
            if begin < cursor:
                raise ValueError(f'Overlapping attribution phrases in {slug}')
            rendered += e(text[cursor:begin]) + f'<a href="{e(url)}">{e(text[begin:end])}</a>'
            cursor = end
        rendered += e(text[cursor:])
        paragraphs.append(f'          <p>{rendered}</p>')
    related = [other for other in ACTIVE_ARTICLES if other['slug'] != slug][:3]
    related_cards = '\n'.join(f'''          <article class="related-story">
            <a href="../{e(other['slug'])}/"><div class="related-image{' trim-image' if other['image']['trim'] else ''}"><img src="../../{e(other['image']['src'])}" alt="{e(other['image']['alt'])}" width="{other['image'].get('width', 2048)}" height="{other['image'].get('height', 1152)}" loading="lazy" /></div><p class="category">{e(other['category'])}</p><h3>{e(other['title'])}</h3></a>
            <p class="byline">Tony Hernandez</p>
          </article>''' for other in related)
    photo = article['image']
    photo_style = f' style="--photo-width: {int(photo.get("width", 600))}px"' if photo.get('portrait') else ''
    photo_credit = ''
    if photo.get('credit'):
        if not photo.get('sourceUrl', '').startswith('https://'):
            raise ValueError(f'Expected an HTTPS photo source for {slug}')
        photo_credit = f' <a href="{e(photo["sourceUrl"])}">{e(photo["credit"])}</a>'
    archive_notice = '\n          <p class="archive-notice">From the archive. This story reflects reporting at its original publication date.</p>' if article.get('archived') else ''
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
          <p class="article-dek">{e(article['dek'])}</p>{archive_notice}
        </div>
        <figure class="article-figure{' portrait-figure' if photo.get('portrait') else ''}"{photo_style}>
          <div class="article-image{' trim-image' if photo['trim'] else ''}{' portrait-image' if photo.get('portrait') else ''}"><img src="../../{e(photo['src'])}" alt="{e(photo['alt'])}" width="{photo.get('width', 2048)}" height="{photo.get('height', 1152)}" fetchpriority="high" /></div>
          <figcaption>{e(photo['caption'])}{photo_credit}</figcaption>
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
            <div class="article-tools"><time datetime="{article.get('updated', article['published'])}">{e(article['dateLabel'])}</time><span>{read_minutes} min read</span><button type="button" id="copy-article-link" hidden>Copy link</button></div>
            <p id="article-status" role="status"></p>
            <div class="article-body">
{chr(10).join(paragraphs)}
            </div>
          </div>
        </div>
      </article>
      <section class="related-section" aria-labelledby="related-heading"><div class="section-heading"><h2 id="related-heading">More from Chiefs News</h2><a href="../">Story archive →</a></div><div class="related-grid">
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

archive_header = relocate(home_header, '../', home_fragments=True)
archive_header = archive_header.replace(' aria-current="page"', '')
archive_header = archive_header.replace('href="../news/"', 'href="../news/" aria-current="page"')
archive_footer = relocate(home_footer, '../')
archive_cards = '\n'.join(story_card(article, '../', archive=True) for article in ORDERED_ARTICLES)
archive = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Browse the Chiefs News story archive: football analysis, team news and life off the field." />
    <title>Story archive | Chiefs News</title>
    <link rel="stylesheet" href="../style.css" />
    <script src="../theme.js" defer></script>
  </head>
  <body class="archive-page">
    <a class="skip-link" href="#main">Skip to archive</a>
    {archive_header}
    <main class="archive-main" id="main" tabindex="-1">
      <a class="back-to-news" href="../">← Back to the news</a>
      <div class="archive-heading"><p class="category">From the newsroom</p><h1>Story archive</h1><p>Every story from Chiefs News, newest first. Catch up on the coverage you missed.</p></div>
      <div class="section-heading"><p>{len(ARTICLES)} stories</p><p>Newest first</p></div>
      <div class="archive-grid">
{archive_cards}
      </div>
    </main>
    {archive_footer}
  </body>
</html>
'''
(ROOT / 'news/index.html').write_text(archive)
print(f'Rendered {len(ARTICLES)} articles, {len(LATEST_ARTICLES)} Latest cards and the complete story archive.')
