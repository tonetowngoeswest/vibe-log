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

## Try it yourself

1. Open `index.html` and add two entries.
2. Refresh and check whether they remain in your browser.
3. Remove an entry, then remove the last one to see the empty state.
4. Try submitting only spaces and navigating with the Tab key.
5. Change a color in `style.css`, refresh, and record what you learned here.
