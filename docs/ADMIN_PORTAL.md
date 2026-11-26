# Admin portal

The staff console at `/admin`. One page with in-memory views (like the app shell), so it works identically on web and inside the Capacitor apps. Staff reach it from the shield icon beside the profile avatar in the header (shown to any active staff member, whatever their role).

## Security model

The portal has **its own sign-in**. It never reads the buddget app session: being signed in to the app opens nothing, and the app cookie or Bearer token is ignored by every `/api/admin/*` route. Three layers, all enforced on the server in `src/lib/server/admin/guard.ts`:

1. **Admin session.** The caller is whoever the admin session token names (`guardAdmin`). Opaque 12h session (60 min idle; biometric 4h), stored hashed in `admin_sessions`. Web: `__Host-bdg_admin`, `HttpOnly; SameSite=Strict`, host-only. Native: token in `sessionStorage` sent as `X-Admin-Session`. All mutations also need `X-Requested-With: buddget-admin`.
2. **Active staff record.** `admin_staff` row for the session's account, re-read on every write (5s cache on reads). Suspended = no access.
3. **Permission** for the specific action. Dangerous actions (delete user, reset a user's account, role/permission changes, resetting or removing staff) additionally ask for a **step-up**: a fresh emailed code or the admin password (`useStepUp` / `stepUp.ts`). Failed step-ups count towards the same lockout as unlocking.

**The admin password is the portal's own**; the buddget account password is never asked for or checked. **The second factor is a 6-digit code emailed to the account** with Supabase `signInWithOtp({ shouldCreateUser: false })` and checked with `verifyOtp({ type: 'email' })` through a non-persisting anon client (`emailCode.ts`), exactly like the app's email sign-in. Codes are single-use (Supabase consumes them) and bound to the account. The authenticator app and recovery codes are gone; the old `totp_*` and `recovery_hashes` columns on `admin_credentials` are **unused** (kept, not dropped) and `admin_sessions.method` still allows the retired `password_totp` / `recovery` values for old rows.

**Sign-in** (`guardSignIn`, before a session exists): staff email + admin password (`POST /api/admin/auth/code` mails the code only when the password is right), then the emailed code (`POST /api/admin/auth/login`). Unknown address, non-staff account, wrong password and wrong code all get the same 401. **First-time setup**: staff email -> emailed code (`/auth/setup`, always answers `{ ok: true }`) -> code + new admin password (`/auth/setup/confirm`); it only works for staff who never finished setup, so it cannot replace an existing password.

**No SSO.** The "stay unlocked while signed in to buddget" switch and `/api/admin/auth/sso` are removed (2026-11-17); `admin_credentials.sso_enabled` is unused (kept, not dropped). The profile menu still shows **Admin portal** to staff (from the `is_staff` claim), but it only opens the portal's sign-in.

Details: scrypt password hashes; 5 failed unlocks or step-ups lock the account 15 minutes; login, code sending, biometric, setup and step-up are rate limited through `admin_rate_hit` (sign-in IP limit per IPv6 /64). A locked account gets the same reply as an unknown address. Sign-in fails closed when the rate-limit RPC errors, so a database stall blocks staff sign-in until it recovers (deliberate).

**Biometric sign-in (iOS/Android apps).** Enrolled from a signed-in admin session (`/api/admin/auth/biometric/device`); the device keeps a secret behind the OS biometric prompt and the server stores only its hash. The enrolled device names the staff member; password + emailed code remain the fallback.

**Owner.** `m.mousaofficial@gmail.com` is the owner with the wildcard permission. The `admin_guard_owner` trigger makes that row immutable (no role change, suspension, deletion or second owner) even for the service role; `admin_roles.owner` is likewise locked and system roles cannot be deleted. Only someone with direct database access can drop those triggers. `users.delete` is owner-only whatever a role says.

**Bank message content (`users.financial`).** The SMS log never returns message text in a list. Staff with `users.financial` (today only the owner, through the `*` wildcard: no other system role holds it, checked against live `admin_roles` on 2026-11-06) can reveal one message at a time: a written reason is required (8+ characters), reveals are rate limited (60 an hour) and each writes `pii.sms.reveal` to the audit log with the log id, the user and the reason. Everyone else sees only that a message exists. The same rule hides the balance a message reported. Creating a ticket from an SMS row no longer copies the text into the ticket; it records the log id. Health probes: `GET /api/health` (shallow) and `GET /api/health/deep` (database and metrics-cache age, rate limited, status only).

**Financial access grants (data tier T3).** A user's transactions, balances, debts and goals open only on the user's *Financial* tab, behind a grant (`admin_access_grants`, migration 0164). Holders of `users.financial` (today only the owner) open it themselves for 30 minutes with a written reason; staff who only hold `users.pii` (support lead) file a request that a `users.financial` holder approves. A grant can be extended once and closed at any time. The check lives in SQL (`admin_has_grant` inside `admin_user_financial_snapshot`), so no route can read financial content without a live grant. Every request, approval, extension, close and read writes an audit row (`pii.financial.*`), and each read adds a line to the user's own notification feed ("Support viewed your account", with the ticket number), at most one per ten minutes. Reads are rate limited to 60 an hour per person, and nobody can open a grant on their own account or on staff at or above their rank.

**Resetting a user's account** (`users.reset`, held by the `admin` role and the owner; step-up required; never on yourself or staff at or above your level) erases all of the user's data and blanks what their profile learned from it (household, rent, budget answers, active plan), then stamps `profiles.data_reset_at`. Their sign-in, plan and membership stay. Every device of that account compares the stamp with the last one it honoured (`src/lib/supabase/remote/resetEpoch.ts`) and drops its local copy on its next sync instead of pushing the erased data back; a device that never recorded a stamp adopts it without wiping. The app's own *Start fresh* stamps it too.

**Staff and their app account.** The portal sign-in *is* the Buddgy sign-in, and `admin_staff`, `admin_credentials`, `admin_sessions` and the admin biometric devices cascade from `auth.users`. So when staff delete their own app account (Settings, self-service), the app account is emptied the same way (data, profile answers, SMS pairing, push tokens) but the sign-in and every admin record are left untouched (`deleteUserCompletely(..., { keepStaffAccess: true })`). Removing a staff member's whole account stays a portal action. Everything privileged is written to the append-only `admin_audit_log`.

## Roles and permissions

`src/lib/admin/permissions.ts` is the catalog of permissions; `admin_roles` (DB) says which role holds which. System roles (live `admin_roles`, by rank): owner, admin, then at rank 20 compliance, engineer, growth, finance, data_ai, product, support_lead, then support_agent (30) and viewer (90). Custom roles can be created in *Team & roles*. Rules: staff can only manage people and roles ranked below them (lower rank = more power), and can only hand out permissions they hold. Staff without `users.pii` see masked emails and no phone/city.

## Adding a section

1. Add a permission to `PERMISSIONS` if needed, and grant it in `admin_roles` (migration).
2. Add the API route under `src/app/api/admin/<name>/route.ts` using `guardAdmin(req, { permission })`; audit mutations with `ctx.audit(...)`.
3. Add the view in `src/components/features/admin/views/`, register it in `AdminApp.tsx` (`VIEWS`) and in `src/lib/admin/nav.ts`.

## Monetization, trials and loyalty (structure only)

Nothing is wired to a payment provider yet; the structure is live so launching is configuration, not migration.

- `plans` — freemium ladder (limits, features, prices, `trial_days`). `free` is the default plan.
- `user_entitlements` — one row per user who deviates from the default: plan, status (`active | trialing | past_due | canceled | expired | paused`), `trial_ends_at`, `current_period_end`, per-user `limit_overrides` / `feature_overrides`, `source` (`admin | apple | google | stripe | promo | loyalty`).
- `src/lib/entitlements/` — `resolveEntitlements` turns those rows into what a user may do **now** (lapsed trials/periods fall back to the default plan with no cron). `getUserEntitlements` (server) and `GET /api/entitlements/me` (for the app). The budget AI route already reads `ai_budget_per_hour` from it. Limits marked `enforced: false` in `LIMIT_CATALOG` are stored and editable but not yet checked by the app; flip them when you gate those features.
- **Free trial:** grant `trialing` from a user's *Plan & limits* tab (length defaults to the plan's `trial_days`). When billing ships, create the entitlement with `source` = the store/provider on purchase and a `trialing` status at trial start.
- `loyalty_tiers`, `loyalty_accounts`, `loyalty_ledger` — tiers by lifetime points (`tierFor`), manual adjustments from profiles. Earning rules are the next piece.
- `feature_flags` (rollout %, platform and plan targeting) and `platform_settings` (maintenance, announcement, minimum app version) are editable now; the app begins honouring them once its client reads them.

## Environment

No new variable is required. Optional: `NEXT_PUBLIC_ADMIN_HOST` (default `admin.buddget.app`). `ADMIN_AUTH_SECRET` and `ADMIN_PIN` are no longer used.

## Database

Migrations `0159_onboarding_flag` (the `onboarding_v1` rollout flag, 10% to start, staff always on), `0160_admin_onboarding_funnel` (the first-run journey funnel on Growth & engagement), `0158_user_reset` (adds `profiles.data_reset_at` and grants `users.reset` to `admin`), `0123_admin_portal_core`, `0124_admin_support_monetization`, `0125_admin_analytics_functions`, `0130_admin_sso_email_codes` (adds `sso_enabled` and `setup_completed_at`, backfilled from `totp_confirmed_at`; allows the `password_email` session method). All tables are service-role only (RLS on, no policies, grants revoked). Analytics come from `admin_*` SQL functions callable only by `service_role`.

## QA and hardening notes
- Biometric unlocks last 4h (password + code: 12h). In production the session cookie is `__Host-bdg_admin` (host-only, so each host has its own).
- Rate limiting uses `admin_rate_hit` (migration 0126); analytics perf indexes/functions are in 0127.
- Integration tests run the real route handlers against a local Postgres: `bash scripts/qa/setup.sh`, then `QA_PG_URL=… npx vitest run --fileParallelism=false src/lib/server/admin` (the `*.pg.test.ts` files skip without `QA_PG_URL`).

## Inviting teammates
Add teammate (Team & roles) creates the staff record and emails a one-tap link (Supabase auth mailer: account invite for new emails, magic link for existing accounts) pointing at `https://admin.buddget.app/auth/callback?next=/admin` (the app origin on localhost and previews). The callback forwards to `/admin/accept`, which reads the session from the link, signs the person in and opens the portal, where first-time setup (admin password + emailed code) runs. "Resend invite" is on any teammate who has not finished setup. Sends are rate limited (30/hour per inviter, 5/hour per address) and audited.

## Opening the portal
Go to https://admin.buddget.app/ (or the profile menu's **Admin portal**, which lands there). It always opens on the portal's own sign-in unless you already have a live admin session in that browser; it never forwards to the app. First visit: **First time here?** -> staff email -> emailed code -> choose an admin password.

## Admin domain setup
The same deployment serves both hosts (`src/middleware.ts`, pure routing in `src/lib/admin/host.ts`):
- `admin.buddget.app`: `/` is the portal (rewrite to `/admin`); only `/admin*`, `/api/*`, `/auth/callback*` and static assets are served; every other path redirects to the same path on `buddget.app`. Signed-out visitors on `/` are redirected to `https://buddget.app`.
- `buddget.app`: `/admin` and `/admin/*` redirect to the admin host (the `#` fragment of invite links survives the redirect). `/api/admin/*` stays reachable here for the native apps, whose behaviour is unchanged.
- Any other host (localhost, Vercel previews): no redirects, `/admin` works as before. `NEXT_PUBLIC_ADMIN_HOST` overrides the admin host; the app host is that value without its first label.
- **Shared sign-in.** In production the Supabase auth cookie gets `Domain=.buddget.app` (`src/lib/supabase/cookieDomain.ts`; middleware, server and browser clients) so one sign-in covers both hosts. Hazard handled: existing sessions have a host-only cookie of the same name, and the browser keeps both and lists the older one first. Middleware therefore (a) reads the newest copy when a name repeats, (b) on the first request per host re-issues the auth cookies on the shared domain and expires the host-only ones, marking the host with the host-only cookie `bdg-cookie-domain`, and (c) expires the host-only twin on every token refresh. The browser client does the same on every write. Result: nobody is signed out by the rollout.

**The owner must still configure:**
1. Supabase Auth, URL Configuration: add `https://admin.buddget.app/**` to *Redirect URLs* (keep `https://buddget.app/**`). Without it invite links fall back to the Site URL.
2. Optionally customise the *Magic Link* email template so it shows the 6-digit code (`{{ .Token }}`); the app's email sign-in already relies on this, and the admin portal uses the same email.
3. Vercel: nothing required (domain already linked). `NEXT_PUBLIC_ADMIN_HOST` only if the host differs from `admin.buddget.app`.

## Emails (templates, send log)
Admin > Emails (`emails.view` to read, `emails.manage` to edit; admin and engineer hold both). Migration `0136_email_templates` adds `email_scenarios`, `email_templates` (one draft + one published row per key and language), `email_template_versions` (every publish, restorable) and `email_log` (never holds codes, links or variables). Service role only.
- **Code:** `src/lib/email/*` is pure and shared with the editor preview (variables, block renderer, built-in English/Arabic copy, validation). `src/lib/server/email/*` has `renderEmail` (published template in the person's language from `user_settings.language`, falling back to English then the compiled copy, so a bad edit never blocks a sign-in; 30s cache, invalidated on publish), `sendTemplatedEmail(key, recipient, vars, opts)` (Resend, Idempotency-Key, 4s timeout, logs to `email_log`) and webhook signature checking.
- **Custom scenarios:** create one in Emails > New email, then call `sendTemplatedEmail('your_key', { email, id }, { ...vars })`.
- **Delivery status:** point a Resend webhook at `/api/webhooks/resend` and set `RESEND_WEBHOOK_SECRET`.
- **Auto-translation:** publishing a template drafts the other language with Buddgy's model (`GEMINI_API_KEY`) unless that language already has a draft or was edited by hand. The draft is never published automatically; "Translate from ..." in the editor redoes it. A translation that drops or renames a `{{variable}}` is rejected.
- **Replacing Supabase's mailer (the hook):** `/api/auth/email-hook` handles sign-up, invite, magic link / code, recovery, email change (two emails when secure change is on), re-authentication and the password/email-changed notices. Phone, identity and MFA notices are acknowledged and not mailed. Emails > Setup shows the checklist and proves the hook is live (last hook email, 24h counts).
- Admin unlock codes no longer touch Supabase's mailer: `emailCode.ts` mints the OTP with `generateLink` and mails `admin_unlock_code` itself.
- Admin invites already go through `sendTemplatedEmail('invite_admin', ...)`.
- **Welcome email:** `POST /api/auth/welcome` (called once per device after sign-in by `AuthProvider`) claims `profiles.welcome_email_sent_at` with one atomic UPDATE, so it is sent exactly once per account and only to accounts under 72 hours old; migration `0137` marks every existing account as welcomed. A failed send releases the claim.
- **Seeding:** `src/instrumentation.ts` makes sure all built-in emails (English and Arabic, v1, published) exist whenever a server instance starts.
- **In the apps:** the portal is the bundled `/admin` page (shield icon in the profile menu, staff only). It talks to the production API with the app session; "Back to buddget" reloads the app shell.

## Performance notes (2026-10-20)
- Admin reads: identity is verified locally from the JWT and staff, role and credentials are remembered for 5 s per instance; every write skips that and asks the Auth server and the database fresh.
- Overview and analytics are served from `admin_metrics_cache` (no cron since migration 0300: a view older than 15 minutes is served stale and refreshed in the background by one advisory-locked refresher; only a missing key is computed live). Activity numbers read `app_activity_days` (daily rollup plus not-yet-rolled raw events); DAU is "active today (UTC)".
- Minimum app version (Platform): releases below it are refused (426) by the database and by the API, and the app shows an update screen with the links entered there.


## Accounts refactor (2026-10)

- **SMS log** rows now show whether the message's balance was recorded (`balance reported`) and whether it was linked to an account. The balance value itself is returned only to staff holding `users.pii`, same gate as the raw message body.
- **Account deletion and data reset** (`deleteUserCompletely`, `/api/account/reset-data`) also clear `account_adjustments` and `account_balance_reports` (children of `payment_methods`, so they go first). Both tables are also covered by the auth-user cascade.
- `housekeeping` (pg_cron `housekeeping`) purges balance reports older than 14 days and the 90-day tombstones of `account_adjustments`; no new job.
- Nothing else in the portal reads `payment_methods`, `savings_*` or the new tables.
