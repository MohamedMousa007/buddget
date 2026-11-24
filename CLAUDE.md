# buddget — Claude Rules

Extends the global master at `~/.claude/CLAUDE.md` (behaviour, token economy, code style). These are buddget-specific and win on conflict.

## Session start
- Read `CLAUDE_CONTEXT.md` for architecture, design tokens and DB state.
- DB-first: run `list_migrations` / `list_tables` on Supabase project `tzioppxwsljhlglyducm` (Frankfurt, eu-central-1; the old Singapore `ydihurtbcnoflhormgzi` is retired) and confirm the live schema matches `src/lib/supabase/database.types.ts`. The `supabase/migrations/` folder is the record of migrations; the ledger table behind `list_migrations` is informational only (files applied with `execute_sql` never write it), so never diff the folder against it.

## Workflow
- Lifecycle: classify tier -> scope context -> execute -> type-check and diff audit -> open a pull request (never push straight to dev or main; the owner merges). Full tests wait for the owner's word. No plan-approval step, with one exception: a UI-only change waits for the owner's approval of its mockup (see "What to test").
- Branching: work on a branch and open a PR to main; no direct pushes unless the owner says so.
- Gate (runs only when the owner says to test, see "Tests run only when the owner asks"): `npm run verify` must pass before the owner-approved merge and before any native build (lint, types, tests in Cairo with coverage floor and New York, migration check, dependency audit, production build with dummy Supabase env). Lint errors in `src/` block commit; warnings are fine.
- Plus a diff audit for correctness bugs before every push.
- GitHub Actions is not relied on.
- `e2e/` (Playwright journeys and API specs) is test-only: excluded from `tsconfig.json`, so it never affects type-checking or `npm run build`, and it needs `@playwright/test` only when someone runs those suites on purpose.
- Parallel sessions can share this checkout: `git add` only your own paths, never `-A`.
- After pushing, confirm it landed (`git log origin/main -1`). A denied push is the first line of the summary.

## Tests run only when the owner asks (owner rule, 2026-11-24; supersedes "tests run in the cloud on every change", 2026-11-19)
- No session runs tests, `npm run verify` or a dev server on its own after a change. The owner says when to test all accumulated changes at once; until then a change is only written, type-checked and diff-audited. When the owner does ask, every run happens in a Claude Code cloud session, never on the owner's Mac: Playwright journeys, the API and UI suites in `e2e/`, the live sync and SMS suites, `npm run verify`, `npm test`. A session on the Mac does not start a dev server or a test runner. It hands the run to the cloud QA runner and waits for the result. Native builds stay local (see below).
- Reuse one cloud QA runner. Find it with `list_sessions` (tag `qa-runner`) and send it the job with `send_message`: what to run, which branch, and what to report. Its checkout, `node_modules`, `.env.local` and dev-server setup are already there. Start a new cloud session only when no runner exists or it is archived, and tag it `qa-runner`. The runner fetches the asked branch before each job.
- Test cases come from the suites first. Before writing a test, search `e2e/README.md`, the suite folders (`e2e/journeys/specs/**`, `e2e/api/**`, `e2e/ui/**`, `e2e/sync/**`, `e2e/sms/**`) and the latest reports in `docs/qa/round2/` for a case that already covers the need, and run that one. If none fits, add the new case to the matching suite folder, in the same style (fresh synthetic `qa-e2e-*` users, `test.fail` for an open bug with its id), and list it in `e2e/README.md`, so the next similar check reuses it.
- Cloud QA method (from QA round 2): `next dev -p 3100 --webpack` with `NEXT_PUBLIC_DEV_AUTH_BYPASS=0` and an empty `NEXT_PUBLIC_API_BASE_URL`, `Africa/Cairo`, workers 1, specs in groups of about 6, a sign-in per run, a terse line reporter, screenshots only for flagged items, and every synthetic user deleted at the end (check that 0 are left).

## What to test: by risk, not everything (owner rule, 2026-11-20)
- Test effort follows technical complexity, risk and the chance of regression. This rule decides which tests get written and which `e2e/` suites run; `npm run verify` still gates every push.
- UI-only change (copy, labels, spacing, alignment, typography, colour, moving an existing button or setting, a simple empty state, approved icons, plain card visuals): no new automated test and no Playwright run. Order: before-and-after mockup -> owner approves -> implement -> screenshot of the built result (from the cloud runner; no dev server on the Mac) -> owner tests and approves.
- Complex UI interaction: frontend does not mean low risk. Add a targeted test where the interaction can really fail: card flip when shared CSS or component behaviour changes, modals, overlays and nested sheets, navigation and browser history, iOS swipe-back, keyboard and viewport, drag and snap, selectors that keep form state, multi-step flows, state kept across routes, anything that can navigate or change data by surprise. If the owner can check it by hand with no real regression risk, prefer that.
- Deep technical change: tests are mandatory, written and run. That covers backend, database changes and migrations, Supabase functions, RLS and security, sync, offline, state persistence and conflict resolution, financial calculations, AI usage accounting, payments and subscriptions, StoreKit and Google Play Billing, authentication, device-level state, native Shortcuts, AI context compaction and conversation continuity, concurrency and idempotency, caching and scheduled jobs, error handling and retries. These fail silently; looking at the screen does not catch them. Pick unit, integration, Playwright or native tests by the actual risk.
- Shared component: a cosmetic change that can be checked by eye needs no test. A change to behaviour, state, navigation or function used by several screens gets targeted regression coverage. Do not test every consumer when the change cannot affect them.
- Playwright is for complex journeys, backend-connected flows, persistence and sync, cross-component interaction, billing, Buddgy AI interaction and accounting, navigation and state transitions, and high-risk regressions. No large suites for static UI. Test data is always isolated.
- Final report: label every implemented item as one of **Automated verification** (tests written and passed), **Manual verification required** (UI built, waiting for the owner), **Native verification required** (needs a real device or native environment), **Blocked** (no access or infrastructure to verify).
- Never call something tested when it was only looked at. Never make automated tests a precondition for finishing straightforward UI work.

## Database & migrations
- New feature or domain change: check `supabase/migrations/` first.
- Order: migration -> apply with `execute_sql` -> regenerate `database.types.ts` -> then code. Never write UI against a column the live DB lacks.
- Adding a field to a type in `src/lib/store/types.ts` or a mapper: check whether a SQL migration is needed.
- Before drop/alter column: run a `SELECT` for row counts and data-loss risk.
- A restore, project copy or region move resets every grant to the platform default (it happened on the Frankfurt move). After one, re-apply `0315_function_lockdown.sql` and `0316_table_grants_restore.sql` (both are safe to run again), then check `get_advisors`.
- New tables get nothing for `anon` by default (0316); grant only what a policy needs.
- New functions get no `EXECUTE` for `anon`/`authenticated` by default (migration 0315). Grant it in the same migration, to the narrowest role that calls it; server-only functions get `service_role` only.
- `net.*` (pg_net) stays executable by `PUBLIC`: the objects belong to `supabase_admin`, so our revoke is a no-op (tried 2026-11-19, QA-101, accepted). Never add `net` to the exposed API schemas in the dashboard.

## Database load (the live database is a small instance; protect it)
- Test before you run: `EXPLAIN` (no `ANALYZE`) every new or changed query on the live DB first. No sequential scan on a table that grows with users or events; add the index in the same migration.
- Bound every query: a `WHERE` on an indexed column, a `LIMIT`, and keyset pagination (never `OFFSET` on large tables, never `SELECT *` in app code, never `count(*)` over a whole growing table on a hot path).
- One round trip per screen: batch reads into one RPC or one query with joins; no per-row loops (N+1) in routes, crons or the client.
- Do the work in the database in sets: one `INSERT ... SELECT` / `UPDATE ... FROM`, not a loop of statements. Bulk writes go in batches of at most a few thousand rows with a short `statement_timeout`.
- Cron and background jobs: set-based SQL that returns only the rows that need work, a cursor, and a hard time budget. Never one query per user.
- Indexes: one for every foreign key and every filter or sort used by a hot query; partial indexes for "open" rows; no duplicate or unused indexes. Check `get_advisors` after a migration and fix what it reports.
- RLS policies use `(select auth.uid())` and indexed columns; no function calls per row.
- Keep rows small and tables short: aggregate counters instead of re-counting, retention on event/log tables, no raw event rows kept without a purge.
- Cache what does not change per request (settings, plans, prices) in the server with a TTL; do not read them on every call.
- Diagnostics (`pg_stat_statements`, table sizes, ad-hoc analytics) run one at a time, off peak, with a `LIMIT`. Never run an untested heavy query "to see".
- Details and the measured hot spots: `docs/DB_SCALING_PLAN.md`.
- Queries on live return counts and ids, not emails, names or other personal data. Filter on an email pattern in the `WHERE` (for example `email like 'qa-e2e-%'`) and select `count(*)` or ids. Checks stay just as strong this way, and the safety check that otherwise stops a query in Auto mode stays quiet. When a task really needs personal data back, ask the owner first, say why, then run it.

## UI & design system
- Read `docs/DESIGN_SYSTEM.md` before touching any UI. Tokens only: no hardcoded hex, inputs at standard heights, touch targets 44x44px minimum, safe-area classes.
- Reuse first: search `src/components/ui` and `src/components/features` (heroes use `HeroBand`; sheets, chips, cards, rows have primitives) and name what you reused. A composition of existing parts is not a new component.
- Handoffs and "no deviation" do not bypass reuse; only the user saying so does. If the design can't be built from existing components, or needs a significant size/structure change, raise an alert and wait.
- Never reshape an existing component. Variation = additive variant/prop with unchanged default. Allowed edits: bug, accessibility and token fixes, with tests, same default look, and a note to the user.
- A component's 3rd or 4th variant: propose promoting it to its own component.

## Cloud sessions
- A cloud session clones the starting session's branch. Push it first (`git push origin HEAD`), or the start fails with "requested branch or commit was not found". Verify with `git ls-remote --heads origin <branch>`.
- Keep the brief to one line of goal plus "follow `docs/QA_CLOUD.md`"; the recipe and the `__qa` seed helpers carry the setup, so the session spends no tokens on it.
- Cloud sessions are for QA and read-only checks; they push nothing and never run native builds.

## Native builds (Capacitor)
- Do native edits (AndroidManifest, Gradle, Info.plist, Kotlin/Swift) yourself; never delegate them to the user.
- Web bundle for native comes from `npm run cap:build`, never bare `npx cap sync`.
- Builds are never automatic and always local. Start a build, TestFlight upload or Drive upload only when the user's own message this turn says to build/upload apps; ambiguous wording = ask. Not after a code change, not because a script or button mentions it.
- On "build and upload apps" (or equivalent): always both iOS and Android, never ask which, on this Mac, via `bash scripts/native-release.sh [label]` (cap:build, iOS archive + TestFlight, Android APK to Drive, version bumps committed with `git add -f` and pushed to dev and main). Report TestFlight status and the Drive link.
- Never dispatch `ios-release.yml` / `android-release.yml`. Prerequisites are in the header of `scripts/native-release.sh`; the working tree must be clean and pushed first.
- The Linear bot (`scripts/linear-bot.sh`) is inactive.
