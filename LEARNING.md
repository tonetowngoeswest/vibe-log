# Learning notes

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
