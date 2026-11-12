# Learning notes

## 2026-11-12 — Add three stories and an automatic archive

Added sourced Josh Downs, Mahomes family and Harrison Butker stories with the three supplied photographs, full article pages, Tony Hernandez bylines and natural inline attribution. The Butker story reflects Andy Reid's decision to keep him kicking against Atlanta this week. The large Downs photograph is published as a smaller copy for faster loading; the original uploads are preserved.

The editorial JSON now drives The Latest automatically: the four newest unfeatured stories appear on the homepage, with JSON order breaking date ties. Existing lead/supporting stories keep their placements. A generated archive at `news/` lists every published article newest first, so older stories retain their URLs and remain discoverable when newer coverage arrives. Navigation and article links lead to the archive. No database is required on GitHub Pages; that can follow in the next backend phase.

Takeaway: keeping story data separate from presentation lets one build command update the homepage, archive and article pages together.

Validation: all 12 generated pages passed local link/fragment, image attribute, unique ID and primary heading checks. Confirmed the new three stories plus Swift fill The Latest, all 10 articles appear in the archive, and the three fixed feature placements remain. Repeat generation produced identical files. Independent static review found no remaining issues; `git diff --check` passed. Browser preview was unavailable, so visual appearance remains unverified.

The homepage, archive, three new articles and their photographs returned HTTP 200 from the local server. A temporary-copy check added a future story and confirmed that the oldest Latest card automatically leaves the homepage while its archive entry and article URL remain.

## 2026-11-08 — Create the starter project

### Page structure (`index.html`)

Added a heading, labeled entry form, empty state, and list of entries. Semantic HTML helps browsers and assistive technology understand the page. The deferred script runs after the HTML has been parsed.

### Appearance (`style.css`)

Added a warm background, green accents, readable spacing, and entry cards. A maximum content width keeps long lines readable, and a media query adjusts spacing on small screens. Visible keyboard focus helps people navigate without a mouse.

### Behavior (`script.js`)

Added form submission, newest-first entries, timestamps, and remove buttons. The entry array is the source of truth; rendering rebuilds the list from that array. Empty or whitespace-only entries are rejected. User text is inserted with `textContent`.

### Persistence (`script.js`)

Added local storage so entries can survive a refresh in the same browser. JSON converts the array to and from a string. Loading validates the stored data, and storage failures display a message. Browser settings and how local files are opened can affect persistence.

### Project guide (`README.md`)

Documented how to open the app, what each file does, and a running list of lessons. Add a dated note here and a takeaway in the README after future changes.

## 2026-11-08 — Add the first two entries

Added “Sunday, November 8th: Hello, World!” followed by “I am watching the Chiefs game” as the starting entries. Saved browser entries take precedence, so refreshing preserves edits and removals.

## 2026-11-08 — Switch to Chiefs colors

Changed the page background and primary buttons to Chiefs red (`#E31837`), with gold (`#FFB81C`) accents, card borders, and remove buttons. White cards and dark text keep entries readable. Hover colors provide feedback, and dark focus outlines stay visible on both the red background and white cards.

## 2026-11-08 — Add the Chiefs logo and headline

Changed the headline and browser title to “Chiefs Brand Guide.” Added a local PNG logo from https://www.logo.dev/search/brands/chiefs.com at the top right of the header. Flexbox keeps the logo beside the heading, and a responsive width lets it shrink on small screens. Alternative text identifies the logo for screen readers.

## 2026-11-08 — Add a dark mode toggle

Added a header toggle with an accessible pressed state. CSS variables switch the page, cards, fields, text, and focus colors while keeping Chiefs red and gold accents. The first visit follows the system color preference; an explicit choice is saved in local storage. If storage is blocked, the toggle still works for the current visit. Theme behavior lives in `theme.js`.

## Try it yourself

1. Open `index.html` and add two entries.
2. Refresh and check whether they remain in your browser.
3. Remove an entry, then remove the last one to see the empty state.
4. Try submitting only spaces and navigating with the Tab key.
5. Change a color in `style.css`, refresh, and record what you learned here.

## 2026-11-08 — Convert the journal to a news homepage

Replaced the journal form and entries with a newspaper-style homepage inspired by the supplied screenshots: supporting photo stories on the left, a large lead story in the center, and a latest-headlines column on the right. Integrated all three supplied WebP photographs, with descriptive alternative text. Headlines are `TK`, deks are placeholders, and all bylines are Tony Hernandez.

Built a large Chiefs-red masthead above the navigation. A sticky header uses a negative offset equal to the masthead height: scrolling hides the large banner while the compact logo and navigation remain visible. This avoids scroll listeners and layout jumps. Mobile layouts put the lead story first and stack the columns. Preserved dark mode, its saved preference, keyboard focus, and a skip link. Old journal data is not deleted from browser storage.

Validation: checked all local asset paths, in-page anchors, six `TK` story headlines, six Tony Hernandez bylines, all three supplied photographs, and image alternative text. Homepage, theme script, and photo requests returned successfully from the local preview server. `git diff --check` passed. Browser preview was unavailable, so desktop/mobile appearance and sticky scrolling still need visual review.

## 2026-11-08 — Restore the log as comments and add story copy

Added a full-width red comments section below the news grid. Restored the original log's add/remove behavior, timestamps, starter entries, validation, safe text rendering, and browser storage key so earlier saved entries reappear. The page explains that comments are browser-local. News layout, photos, and dark mode remain intact, with theme-aware form and comment surfaces.

Applied the supplied headlines and deks to the top-left, bottom-left, and center photo stories respectively, keeping Tony Hernandez bylines. Resized the lead headline to fit full story copy on desktop and mobile.

Validation: comment checks passed for starter entries, whitespace rejection, literal text rendering, save/reload, removal, empty state, blocked storage, and malformed data. Checked section placement, form elements, assets, supplied headlines, six bylines, and `git diff --check`. Browser preview remains unavailable.

## 2026-11-08 — Slim the banner and refresh the latest stories

Reduced the expanded masthead from 164px to 124px on desktop and from 120px to 90px on mobile, keeping the existing 112px desktop and 70px mobile logos. The sticky offset follows the same height variable so the compact navigation still stays at the top.

Replaced all three latest-news headlines and deks with the supplied copy, preserving Tony Hernandez bylines. Updated the centered note beneath the lead story with the Tonetown sentence. Verified the exact copy, unchanged logo sizes, and `git diff --check`. Browser visual review remains unavailable.

### Footer placement correction

Moved the Tonetown sentence into the very bottom footer beside CHIEFS NEWS, replacing the independent-coverage sentence. Restored the original centered newsroom note beneath the lead story.

## 2026-11-08 — Add six news article pages

Created a shared article design following the supplied reference: large serif headline, dek, repeated homepage photography, caption, author rail, readable body text, sources, and related stories. Preserved the Chiefs banner, dark mode, comments, and Tonetown footer. Every homepage headline now links to a static page nested under `news/<story-slug>/`; photo-story images are linked too.

Three writing agents researched and drafted two articles each. All six articles are approximately 200–400 words with Tony Hernandez bylines and dated sources. Analysis is distinguished from reporting. Updated the Rice framing to reflect production and availability, the peptide headline to an evidence-check without an invented allegation, and the injury headline to its verified return-to-play snapshot. File-photo captions avoid presenting supplied images as documentation of the reported events.

Article content lives in `news/articles.json`. Run `python3 scripts/build_news.py` to produce the static pages and synchronize the homepage; the generator reuses the homepage header, footer, and comments. Nested pages use relative URLs that work under GitHub Pages' repository prefix. A separate article script adds a copy-link button only when supported.

Validation: an independent review checked all seven pages for local asset/link/fragment paths, unique IDs, one primary heading, image alternative text, article word counts, and source references. Corrected mobile navigation selectors for nested pages and marked the home News link as a section location. Verified repeat generation produces identical output. Copy-link checks passed for supported, blocked, and unavailable clipboard APIs. All six routes, shared files, and photo assets returned HTTP 200 locally; `git diff --check` passed. Browser preview host was unavailable, so desktop/mobile visual appearance remains unverified.

## 2026-11-08 — Add the Swift/Kloss culture story and remove footnotes

Added a new story above the peptide item in The Latest, using the supplied suite photo on the homepage and article. The article reports verified game attendance, discusses the public friendship, references Fluently Forward as commentary, and gives contemporaneous context for “Kissgate.” The dek uses friendship framing rather than repeating an unverified claim about a private relationship. Tony Hernandez remains the byline.

Removed numbered superscripts and the reporting/sources endnote block from every article. Replaced them with natural source links in attributed prose. The generator escapes all plain text and inserts only declared exact-phrase links; source records remain in the JSON for editorial use. Added dimensions and portrait layout support so the supplied vertical photo keeps its full frame on the article page.

Validation: independent static review passed for the homepage and seven articles, including local links/assets/anchors, unique IDs, one H1, image alternative text, no nested anchors, no footnote/endnote markup, escaped inline attribution links, 200–400 word lengths, story order, and the supplied image dimensions. Generator output is idempotent, `git diff --check` passed, and the new article and photo returned HTTP 200 locally. Browser appearance remains unverified because the preview host is unavailable.
