# Admin portal

The staff console at `/admin`. One page with in-memory views (like the app shell), so it works identically on web and inside the Capacitor apps. Staff reach it from the shield icon beside the profile avatar in the header (shown to any active staff member, whatever their role).

## Security model

Four layers, all enforced on the server in `src/lib/server/admin/guard.ts`:

1. **Buddget sign-in.** Every admin request carries the normal Supabase session (cookie on web, Bearer on native).
2. **Active staff record.** `admin_staff` row matched by account id or confirmed email. Suspended = no access.
3. **Unlocked admin session**, one of:
   - **SSO (default).** With the person's switch on and setup finished, the app sign-in *is* the unlocked session (`sso.ts`): no cookie or token, nothing stored, and access ends exactly when the Buddget sign-in ends. Staff status, role and permissions are re-read on every request, so suspension or a role change applies on the next call.
   - **Password + emailed code** (switch off): opaque 12h session (60 min idle), stored hashed in `admin_sessions`, bound to the account. Web: `HttpOnly; SameSite=Strict` cookie. Native: token in `sessionStorage` sent as `X-Admin-Session`.
   - **Biometrics** (native, enrolled device): 4h session.
   All mutations also need `X-Requested-With: buddget-admin`.
4. **Permission** for the specific action. Dangerous actions (delete user, role/permission changes, resetting or removing staff) additionally ask for a **step-up**: a fresh emailed code or the admin password (`useStepUp` / `stepUp.ts`), in SSO mode too. Failed step-ups count towards the same lockout as unlocking.

**The admin password is the portal's own**; the Buddget account password is never asked for or checked. **The second factor is a 6-digit code emailed to the account** with Supabase `signInWithOtp({ shouldCreateUser: false })` and checked with `verifyOtp({ type: 'email' })` through a non-persisting anon client (`emailCode.ts`), exactly like the app's email sign-in. Codes are single-use (Supabase consumes them) and bound to the account. The authenticator app and recovery codes are gone; the old `totp_*` and `recovery_hashes` columns on `admin_credentials` are **unused** (kept, not dropped) and `admin_sessions.method` still allows the retired `password_totp` / `recovery` values for old rows.

First-time setup (owner, invited staff, everyone): choose an admin password, then confirm it with the emailed code (proves mailbox ownership). Nothing is usable until the code is entered. Unlock (SSO off): admin password + emailed code, or biometrics.

**SSO switch (My security).** Stored as `admin_credentials.sso_enabled` (default true), exposed as `ssoEnabled` by `GET /api/admin/auth/status`, changed with `POST /api/admin/auth/sso`. Turning it **off** is stricter and needs nothing extra (the portal locks at once). Turning it **on** loosens the portal, so it needs a step-up (emailed code or admin password): otherwise a hijacked, unlocked session could silently downgrade the owner's protection. Trade-off: with SSO on, anyone holding a valid Buddget session of a staff member (stolen device, XSS on the app origin) is inside the portal; the per-person switch, step-ups for destructive actions, owner immutability and the audit log are the compensating controls. SSO logins are audited (`auth.login`, `via: sso`, at most hourly per person).

Details: scrypt password hashes; 5 failed unlocks or step-ups lock the account 15 minutes; login, code sending, biometric, setup and step-up are rate limited through `admin_rate_hit`.

**Biometric unlock (iOS/Android apps).** Enrolled from an already-unlocked session (`/api/admin/auth/biometric/device`); the device keeps a secret behind the OS biometric prompt and the server stores only its hash. It unlocks only for the same signed-in account and falls back to password + emailed code. It is offered on the unlock screen (relevant when SSO is off) and enrolled from My security.

**Owner.** `m.mousaofficial@gmail.com` is the owner with the wildcard permission. The `admin_guard_owner` trigger makes that row immutable (no role change, suspension, deletion or second owner) even for the service role; `admin_roles.owner` is likewise locked and system roles cannot be deleted. Only someone with direct database access can drop those triggers. `users.delete` is owner-only whatever a role says. Everything privileged is written to the append-only `admin_audit_log`.

## Roles and permissions

`src/lib/admin/permissions.ts` is the catalog of permissions; `admin_roles` (DB) says which role holds which. System roles: owner, admin, support_lead, support_agent, engineer, finance, growth, viewer. Custom roles can be created in *Team & roles*. Rules: staff can only manage people and roles ranked below them (lower rank = more power), and can only hand out permissions they hold. Staff without `users.pii` see masked emails and no phone/city.

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

Migrations `0123_admin_portal_core`, `0124_admin_support_monetization`, `0125_admin_analytics_functions`, `0130_admin_sso_email_codes` (adds `sso_enabled` and `setup_completed_at`, backfilled from `totp_confirmed_at`; allows the `password_email` session method). All tables are service-role only (RLS on, no policies, grants revoked). Analytics come from `admin_*` SQL functions callable only by `service_role`.

## QA and hardening notes
- Biometric unlocks last 4h (password + code: 12h; SSO: as long as the app sign-in). In production the session cookie is `__Host-bdg_admin` (host-only, so each host has its own).
- Rate limiting uses `admin_rate_hit` (migration 0126); analytics perf indexes/functions are in 0127.
- Integration tests run the real route handlers against a local Postgres: `bash scripts/qa/setup.sh`, then `QA_PG_URL=… npx vitest run --fileParallelism=false src/lib/server/admin` (the `*.pg.test.ts` files skip without `QA_PG_URL`).

## Inviting teammates
Add teammate (Team & roles) creates the staff record and emails a one-tap link (Supabase auth mailer: account invite for new emails, magic link for existing accounts) pointing at `https://admin.buddget.app/auth/callback?next=/admin` (the app origin on localhost and previews). The callback forwards to `/admin/accept`, which reads the session from the link, signs the person in and opens the portal, where first-time setup (admin password + emailed code) runs. "Resend invite" is on any teammate who has not finished setup. Sends are rate limited (30/hour per inviter, 5/hour per address) and audited.

## Opening the portal
Go to https://admin.buddget.app/ (or the profile menu's **Admin portal**, which lands there). With SSO on and setup done there is no prompt at all: being signed in to Buddget is enough. Signed-out visitors are sent to Buddget to sign in first. First visit: choose an admin password and enter the emailed code.

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
Admin > Emails (`emails.view` to read, `emails.manage` to edit; admin and engineer hold both). Migration `0133_email_templates` adds `email_scenarios`, `email_templates` (one draft + one published row per key and language), `email_template_versions` (every publish, restorable) and `email_log` (never holds codes, links or variables). Service role only.
- **Code:** `src/lib/email/*` is pure and shared with the editor preview (variables, block renderer, built-in English/Arabic copy, validation). `src/lib/server/email/*` has `renderEmail` (published template in the person's language from `user_settings.language`, falling back to English then the compiled copy, so a bad edit never blocks a sign-in; 30s cache, invalidated on publish), `sendTemplatedEmail(key, recipient, vars, opts)` (Resend, Idempotency-Key, 4s timeout, logs to `email_log`) and webhook signature checking.
- **Custom scenarios:** create one in Emails > New email, then call `sendTemplatedEmail('your_key', { email, id }, { ...vars })`.
- **Delivery status:** point a Resend webhook at `/api/webhooks/resend` and set `RESEND_WEBHOOK_SECRET`.
- **Replacing Supabase's mailer:** Authentication > Hooks > Send Email > HTTPS, `https://buddget.app/api/auth/email-hook`, secret into `SEND_EMAIL_HOOK_SECRET`. Handles sign-up, magic link / code, recovery and re-authentication; other types (email change, invites) return an error, so do not enable the hook until those are covered or accepted.
- Admin invites already go through `sendTemplatedEmail('invite_admin', ...)`.
