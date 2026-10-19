# Admin portal

The staff console at `/admin`. One page with in-memory views (like the app shell), so it works identically on web and inside the Capacitor apps. Staff reach it from the shield icon beside the profile avatar in the header (shown to any active staff member, whatever their role).

## Security model

Four layers, all enforced on the server in `src/lib/server/admin/guard.ts`:

1. **Buddget sign-in.** Every admin request carries the normal Supabase session (cookie on web, Bearer on native).
2. **Active staff record.** `admin_staff` row matched by account id or confirmed email. Suspended = no access.
3. **Unlocked admin session.** Password **and** TOTP authenticator (or a single-use recovery code) → opaque 12h session (60 min idle), stored hashed in `admin_sessions`, bound to the account. Web: `HttpOnly; SameSite=Strict` cookie. Native: token in `sessionStorage` sent as `X-Admin-Session`. All mutations also need `X-Requested-With: buddget-admin`.
4. **Permission** for the specific action. Dangerous actions (delete user, role/permission changes, resetting someone's security) additionally ask for a fresh authenticator code (`useStepUp`).

Details: scrypt password hashes; TOTP secrets AES-256-GCM encrypted at rest with a key from `ADMIN_AUTH_SECRET` (falls back to a key derived from `SUPABASE_SECRET_KEY`); TOTP codes are single-use per time step; 5 failed unlocks lock the account 15 minutes; login/biometric/setup are rate limited through `api_rate_hit`. First-time setup re-proves the account (its password, or a sign-in within 15 minutes).

**Biometric unlock (iOS/Android apps).** Enrolled from an already-unlocked session (`/api/admin/auth/biometric/device`); the device keeps a secret behind the OS biometric prompt and the server stores only its hash. It unlocks only for the same signed-in account and falls back to password + code.

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

No new variable is required. Optional: `ADMIN_AUTH_SECRET` (pins the encryption key for authenticator secrets — set it before rotating the Supabase secret key). `ADMIN_PIN` is no longer used.

## Database

Migrations `0123_admin_portal_core`, `0124_admin_support_monetization`, `0125_admin_analytics_functions`. All tables are service-role only (RLS on, no policies, grants revoked). Analytics come from `admin_*` SQL functions callable only by `service_role`.

## QA and hardening notes
- Biometric unlocks last 4h (password + code: 12h). In production the session cookie is `__Host-bdg_admin`.
- Rate limiting uses `admin_rate_hit` (migration 0126); analytics perf indexes/functions are in 0127.
- Integration tests run the real route handlers against a local Postgres: `bash scripts/qa/setup.sh`, then `QA_PG_URL=… npx vitest run --fileParallelism=false src/lib/server/admin` (the `*.pg.test.ts` files skip without `QA_PG_URL`).

## Inviting teammates
Add teammate (Team & roles) creates the staff record and emails a one-tap link (Supabase auth mailer: account invite for new emails, magic link for existing accounts) pointing at `/auth/callback?next=/admin`. The callback forwards to `/admin/accept`, which reads the session from the link, signs the person in and opens the portal, where first-time setup (admin password + authenticator) runs. For invited people the link sign-in replaces the Buddget account password check during setup. "Resend invite" is on any teammate who has not finished setup. Sends are rate limited (30/hour per inviter, 5/hour per address) and audited. Requirements: `${APP_URL}/auth/callback` in Supabase Auth redirect URLs, and customise the Invite / Magic Link email templates in the Supabase dashboard if the default wording is not wanted.
