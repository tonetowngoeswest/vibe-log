# Chiefs News

A Kansas City football publication with a Next.js application, Supabase accounts/database, an editor dashboard and shared reader comments. The current Chiefs red/gold design, ten story URLs, photos, source attribution and dark mode are preserved.

The original static site remains in this repository for the existing GitHub Pages deployment. The backend application runs on a server-capable host such as Vercel. Keep the legacy site available until the new deployment is verified.

## Run locally

Requires Node.js 24 LTS and Docker Desktop for local Supabase.

```sh
npm ci
npx supabase start
cp .env.example .env.local
```

Configure `.env.local` using the local instance credentials and administrator setup values, then run:

```sh
npm run backend:import
npm run backend:bootstrap
npm run dev
```

Open `http://localhost:3000`. The initial `admin` login uses the password supplied privately during bootstrap and requires a new password before editorial actions. Without backend credentials, the application explicitly displays a read-only preview of the original stories; it does not simulate authentication or saved edits.

See [Backend setup](docs/BACKEND_SETUP.md) for local verification emails, Supabase configuration, Resend SMTP, Vercel deployment, redirects, persistence and recovery. Public signup requires a verified email sender before launch.

## Readers and staff

Readers sign up with email, password and a public display name. Verification and password recovery use email; public comments never expose email addresses. Every article has its own discussion, and the homepage has a separate general conversation. Comments are shared across accounts and devices, with ownership and moderation enforced in the database.

Editors use `/editor/` to edit headlines, deks and paragraph blocks with natural inline attribution links. Save and preview a draft before publishing. Each save creates an immutable revision; restoring history loads it into a new draft. Conflicting saves preserve the unsaved form rather than replacing someone else's work.

The homepage editor controls seven positions: upper left, lower left, center lead and four Latest stories. Drag between slots to swap, replace a story from the archive pool, or use the keyboard controls. Layouts publish together and require seven unique stories. Story publishing and arrangement publishing are independent; changing the layout never publishes another story's pending draft.

Admins additionally manage reader/editor/admin roles at `/admin/users/`. The last administrator cannot be demoted. Server checks and database policies enforce every permission.

## Data and files

- `app/` — server-rendered pages, account flows, editor/admin pages and API routes.
- `components/` — article layouts, reader comments, account forms and newsroom controls.
- `lib/` — server-only authentication/data access, public types and input validation.
- `supabase/` — local service configuration and versioned SQL migrations and authorization rules.
- `scripts/backend/` — idempotent import, one-time administrator setup and PostgreSQL tests.
- `public/` — story photo assets and the Chiefs logo, retaining their existing paths.
- `news/articles.json` — original editorial content and sources, used as the initial migration snapshot.
- `index.html`, `news/*/index.html`, `scripts/build_news.py` — legacy static site files; these do not overwrite the live database.

Once imported, the database is the source of truth. Deployments and repeated imports preserve existing edits, layouts, accounts and comments. Passwords, session tokens and service keys are never committed. Published content is rendered from the database, including article metadata and link previews.

Original browser-local notes under `vibe-log-entries` are not uploaded or assigned to users. `/legacy-export/` explains private export; the old Pages host has `export-comments.html` to read notes from their original origin. Exporting never removes them.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:integration
```

Integration tests require local Supabase and a running development server. They refuse hosted URLs, use temporary reader accounts, and restore article/layout content afterward. PostgreSQL tests use PGlite with a mock Auth schema; local integration tests separately exercise the real Auth/REST services and application endpoints.

Before production cutover verify two reader accounts, signup/reset delivery, private drafts/previews, publish behavior and metadata, seven-slot keyboard/drag arrangements, role boundaries, comment ownership, existing story redirects and mobile/dark appearance. Keep GitHub Pages unchanged until the new host passes those checks.
