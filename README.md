# Chiefs News

An independent football news homepage by Tony Hernandez, built with plain HTML, CSS, and JavaScript. The layout uses the supplied banner and news-page screenshots as references.

Open `index.html` in your browser, or serve this folder with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Files

- `index.html` — masthead, navigation, lead story, supporting stories, and latest headlines.
- `style.css` — Chiefs red and gold branding, responsive news columns, sticky banner, and dark theme.
- `script.js` — saved comments, adding/removing entries, and keyboard focus for navigation back to the stories.
- `theme.js` — dark mode and the saved appearance preference.
- `Images/` — the three supplied story photographs.
- `news/<story-slug>/index.html` — seven complete static article pages.
- `news/articles.json` — article copy, source links, and image selections.
- `scripts/build_news.py` — renders article pages and synchronizes homepage links and copy.
- `article.js` — copies an article URL when supported by the browser.
- `LEARNING.md` — notes on each change.

## Editing stories

Every homepage headline links to a complete article under `news/<story-slug>/`. Articles use **Tony Hernandez** bylines, the supplied photos, and linked reporting sources. Analysis and evidence-checks are identified; injury reporting is explicitly dated. The Rice and peptide headlines/deks have been adjusted to reflect the available evidence. The Swift/Kloss culture story uses the supplied suite photograph and links to attendance reporting, Vogue, Fluently Forward commentary, and contemporary reporting on “Kissgate.” Its dek describes their public friendship rather than an unverified private relationship.

Edit article text and sources in `news/articles.json`, then run `python3 scripts/build_news.py` to regenerate the static article pages and homepage story links. The homepage supplies the shared header, comments, and footer; rerun the generator after changing that shared markup. Both the generated HTML and JSON are committed, so GitHub Pages requires no build step. Relative asset paths preserve the `/vibe-log/` deployment prefix.

Articles are approximately 200–400 words, with natural inline attribution links instead of numbered citations or endnotes. Source records remain in the article JSON for editorial reference. The photos are supplied file images, not evidence of the events described. Comments share the original browser-local log across the site.

## Comments

The original log continues below the news on a red background. Add and remove comments, with the same browser storage key preserving previous log entries. Comments are local to this browser, not public or synced. New browsers start with the original two log entries. Clearing browser data removes saved comments.

## Publishing

Publish the repository root in GitHub Pages. Set **Settings → Pages → Branch** to **main** and **/ (root)** so future merged changes deploy automatically. The site was previously configured to publish `chiefs-brand-guide`, which can leave it behind `main`.

## What I learned

- Semantic HTML gives stories, navigation, and headings meaningful structure.
- CSS Grid supports a lead story, secondary stories, and a latest-news column.
- A sticky header with a negative top offset lets the large masthead scroll away while its navigation remains visible, without JavaScript scroll handlers.
- Media queries bring the lead story first on mobile and stack the other columns.
- CSS variables let dark mode update backgrounds, text, and borders consistently.
- A saved browser preference persists when local storage is available.
