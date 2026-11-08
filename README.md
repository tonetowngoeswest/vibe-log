# Chiefs News

An independent football news homepage by Tony Hernandez, built with plain HTML, CSS, and JavaScript. The layout uses the supplied banner and news-page screenshots as references.

Open `index.html` in your browser, or serve this folder with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Files

- `index.html` — masthead, navigation, lead story, supporting stories, and latest headlines.
- `style.css` — Chiefs red and gold branding, responsive news columns, sticky banner, and dark theme.
- `script.js` — saved comments, adding/removing entries, and keyboard focus for navigation back to the stories.
- `theme.js` — dark mode and the saved appearance preference.
- `Images/` — the three supplied story photographs.
- `LEARNING.md` — notes on each change.

## Editing stories

The three photo stories and the latest-news column use the supplied headlines and deks. Every byline is **Tony Hernandez**. Articles are static previews without story-detail pages.

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
