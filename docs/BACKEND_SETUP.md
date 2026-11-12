# Backend setup and deployment

The application uses Next.js on Vercel and Supabase Auth/Postgres. No provider credentials are committed. Until Supabase is configured, the app explicitly labels its read-only local preview; account and editor operations do not pretend to save data.

## Local development

1. Install Node.js 24 LTS and run `npm ci`.
2. Start Docker Desktop. Run `npx supabase start` from this repository. The CLI starts local Postgres, Auth, the REST API and a local email inbox. Run `npx supabase status` locally to retrieve credentials; do not paste service credentials into chat or commit them.
3. Copy `.env.example` to `.env.local`. Set the URL and publishable/anon key from the local instance, its server-only service-role key, `SITE_URL=http://localhost:3000`, and a test administrator email. Supply the agreed initial administrator password privately through `BOOTSTRAP_ADMIN_PASSWORD`.
4. The local stack applies all files in `supabase/migrations/` in filename order. For an existing local instance, apply new migrations with `npx supabase migration up`; this preserves local accounts and stories.
5. Run `npm run backend:import`, then `npm run backend:bootstrap`. Both are idempotent and will not replace editorial work or reset the administrator on subsequent runs.
6. Run `npm run dev`. Log in as `admin` and change the initial password. The database prevents publishing, role management and commenting until that password changes. Remove `BOOTSTRAP_ADMIN_PASSWORD` afterward; retain `BOOTSTRAP_ADMIN_EMAIL` for the login alias.
7. Test reader signup and recovery in the local inbox at `http://localhost:54324`. Each reader must verify their email. This inbox is a local test tool, not public email delivery.

Use `npm run typecheck`, `npm test` and `npm run build` for checks. `test:db` runs actual PostgreSQL schema/RLS/transaction tests in PGlite with a mock Supabase Auth schema; it does not substitute for testing the real Auth service. `npm run test:integration` runs the real local HTTP/Auth/REST flow after local setup and a development server are running.

`npm run test:integration -- --email-only` checks the actual verification/recovery emails captured by Mailpit, including the PKCE callback. The main integration suite changes the disposable local administrator password and caches it privately for reruns; it refuses hosted URLs and non-test administrator addresses. Use a disposable local database for these checks. To return that test instance to the first-login experience, stop the app, run `npx supabase db reset --yes` **without `--remote`**, then rerun the content import/bootstrap and remove `/private/tmp/vibe-log-integration-admin.json`. This reset is only for the newly created local test database and deletes its test data.

This repository uses Supabase CLI v3 configuration: the local inbox section is `[local_smtp]`, and email authentication uses `[auth.email] enabled = true`. Keep the committed package lockfile when installing the CLI. If Docker Desktop uses its per-user socket, set `DOCKER_HOST` to that local socket for CLI commands. The local stack retains database data in Docker volumes when stopped normally.

## Hosted Supabase

Create a user-owned Supabase project, apply all migrations in filename order, and configure the environment values from `.env.example` in Vercel. The publishable key is public; the service-role key is used only by the import/bootstrap commands and must never be exposed in browser code. The deployed app uses verified user sessions and database policies for editorial and comment mutations.

With CLI v3, database commands target the local stack by default. For a hosted migration, first link the intended project with `npx supabase link --project-ref YOUR_PROJECT_REF`, then run `npx supabase db push --remote` and confirm that target. An approved unattended deployment uses `--yes --remote`. Review `npx supabase config diff` before pushing hosted Auth configuration, because local `.env.local` values can override project configuration. See the [official CLI v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3).

Run the import and bootstrap against this project once from a private local environment. Import all ten existing articles and the current seven-story layout; the JSON becomes a migration snapshot, while the database becomes the editorial source of truth. Preserve the original JSON for recovery. Ongoing editor saves do not write to GitHub or require a deployment.

Set the Supabase site URL to the exact deployed HTTPS origin. Allow `/auth/callback/` on that origin and the development origin, with and without trailing slash. Do not add wildcard redirect hosts. Recovery redirects must return to `/auth/callback/?next=/reset-password/`.

For confirmation links that work across devices, configure the signup email template to link to `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email&next=/account/`. Use `type=recovery&next=/reset-password/` for the recovery email. The application also supports the default PKCE callback flow in the browser that requested the email.

## Verification and recovery email

Public launch requires a verified sending domain and Resend SMTP account. No domain purchase is included or authorized. Once the owner supplies a domain, configure its DNS as instructed by Resend, verify the sender, and enter its SMTP settings in Supabase Auth. Keep these SMTP credentials in provider settings, not the repository.

Keep email confirmation enabled. Supabase's default hosted mailer is intended for project-team testing and cannot be relied on for public signup. Verify both signup and password-reset delivery to an address outside the Supabase project team before launch. After bootstrapping the temporary administrator password, set the hosted Auth minimum password length to 12 before enabling public reader signup. Retain the application checks and Auth rate limits.

## Vercel rollout

Import this GitHub repository as a Next.js project, configure the environment, and create a preview deployment. Never share a database containing production data with untrusted branch previews. Verify the complete acceptance checklist in `README.md` using two reader accounts and an editor before moving production traffic.

Existing GitHub Pages remains available until the new deployment and real email delivery pass. After cutover, prepare redirects in a **separate directory**:

```sh
node scripts/prepare-legacy-redirects.mjs https://your-new-site.example /tmp/chiefs-pages-redirects
```

Review and deploy that directory to the old Pages host in a separate publishing change. It redirects the homepage, archive and each existing story to its corresponding new route while retaining the private notes exporter. Never auto-import old browser-local comments or attach them to an authenticated account.

## Persistence and recovery

Article revisions are immutable; the editor can load an older revision and save it as a new draft. Layout publishing and story publishing are independent transactions with version checks. A failed save must leave the local form intact; resolve conflicts by reviewing the newer saved version.

Use the database provider's supported backups or a private Postgres export before schema changes and cutover. Comments and accounts live in the database, not Vercel's filesystem. The app does not remove records when redeployed. Roll back application code through Vercel without resetting the database or rerunning a destructive import. For runtime failures, inspect Vercel request errors and Supabase Auth/database logs; never log passwords, session tokens or service keys.
