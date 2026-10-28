# Aisle Match admin console

Private admin console served from Webflow (`/admin`) by one script on jsDelivr.

- `src/` front end (vanilla JS, shadow DOM, hash router). `sh build.sh` writes `admin.js`.
- `supabase/functions/admin-api/index.ts` the only back end. Verifies the Supabase token, checks the email is in `ADMIN_EMAILS`, then uses the service role. Every write is audit logged.
- `sql/14_admin_console.sql` tables for audit log, notes, reports, launch checklist.
- `test/` fake-backend harness that runs the real admin-api code and a Playwright test (`sh test/all.sh`, `MOBILE=1 sh test/all.sh`).
- Releases: `sh release.sh 1.0.1` (never reuse a tag).

See `SETUP.txt`.
