# Chiefs News

An independent football news homepage by Tony Hernandez, built with plain HTML, CSS, and JavaScript. The layout uses the supplied banner and news-page screenshots as references.

Open `index.html` in your browser, or serve this folder with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Files

- `index.html` — masthead, navigation, lead story, supporting stories, and latest headlines.
- `style.css` — Chiefs red and gold branding, responsive news columns, sticky banner, and dark theme.
- `script.js` — keyboard focus for navigation back to the stories.
- `theme.js` — dark mode and the saved appearance preference.
- `Images/` — the three supplied story photographs.
- `LEARNING.md` — notes on each change.

## Editing stories

Every story headline is currently **TK**, and every byline is **Tony Hernandez**. Deks are placeholder summaries; replace them in `index.html` when copy is ready. Articles are static previews without story-detail pages. The homepage replaces the journal interface; previously saved journal data is left in browser storage.

## Publishing

Publish the repository root in GitHub Pages. Set **Settings → Pages → Branch** to **main** and **/ (root)** so future merged changes deploy automatically. The site was previously configured to publish `chiefs-brand-guide`, which can leave it behind `main`.

## What I learned

- Semantic HTML gives stories, navigation, and headings meaningful structure.
- CSS Grid supports a lead story, secondary stories, and a latest-news column.
- A sticky header with a negative top offset lets the large masthead scroll away while its navigation remains visible, without JavaScript scroll handlers.
- Media queries bring the lead story first on mobile and stack the other columns.
- CSS variables let dark mode update backgrounds, text, and borders consistently.
- A saved browser preference persists when local storage is available.
