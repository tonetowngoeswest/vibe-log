# Database setup commands

These commands use the server-only service credential. Never put that credential in a `NEXT_PUBLIC_` variable or browser code.

1. Create the Supabase project and apply all SQL files in `supabase/migrations/` in filename order, either through the Supabase CLI migration workflow or the project SQL editor.
2. Configure the project's site URL and allowed auth callback URLs to the deployed application's origin and `/auth/callback`. For local development, the checked-in Supabase configuration uses `http://localhost:3000`.
3. Add the Supabase URL and server service credential to the local environment, then run `node scripts/backend/import-content.mjs --dry-run` to inspect the import.
4. Run `node scripts/backend/import-content.mjs`. It imports missing stories and initializes the homepage only when no published layout exists. Re-running it never overwrites an editor's story or arrangement.
5. Set `BOOTSTRAP_ADMIN_EMAIL` to the administrator's actual recovery address and `BOOTSTRAP_ADMIN_PASSWORD` to the agreed initial password, then run `node scripts/backend/bootstrap-admin.mjs`.
6. Log in as `admin`, change the initial password, and remove `BOOTSTRAP_ADMIN_PASSWORD` from the environment. The one-time command never resets an existing administrator's password, role or display name.
7. Configure verified SMTP delivery and the sending domain before enabling public reader signup. Local Supabase captures verification and recovery emails in its local mail inbox instead of delivering them publicly.

The site-facing database contract uses `published_stories` and `published_homepage` views for public reads. Editorial and account data is read through role-checked RPC functions. Exposed base tables have row-level security; clients receive no direct mutation privileges.

Article revision `content` preserves the legacy JSON shape, including `paragraphs` and exact-text `paragraphLinks`. Draft saves may change the headline, dek, paragraphs and attribution links. Photo/source metadata, dates and slug are retained by the database. Publish creates another immutable revision and advances the published pointer in the same transaction. Article and layout version checks use PostgreSQL error code `40001`; clients should preserve unsaved work and offer a reload instead of overwriting the newer version.

The seven layout keys are `leftTop`, `leftBottom`, `lead`, `latest1`, `latest2`, `latest3` and `latest4`. Values are story UUIDs. Draft slots may be null; published layouts require seven distinct published stories. Archive membership is derived from the published layout. Changing a layout never publishes pending article drafts.

`list_comments` takes a story UUID, or null for the homepage discussion. It returns only visible comments with a safe public display name and role label, never email addresses. Pagination uses the last row's `created_at` plus `id` as `p_before` and `p_before_id` to avoid losing simultaneous comments. Reader emails are exposed only by the admin-only `list_app_users` function.
