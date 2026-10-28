# REVIEW B3 (adversarial, read-only) - privacy + security batch, migrations 0201-0208

Method: read the uncommitted diff and all eight migrations, compared every rewritten function with `pg_get_functiondef` on the live project (ydihurtbcnoflhormgzi, SELECT only), checked grants, ACLs, default privileges, FKs, triggers, cron and `pg_db_role_setting` live. Nothing was applied or edited besides this file.

Counts: 24 findings. 1 blocker, 3 high, 11 medium, 9 low.

## Verdict table

| Migration | Verdict | Why |
|---|---|---|
| 0201 grants lockdown | OK-after-fix | F2 (trusted_devices own SELECT keeps the 2FA device id readable), F9 (default privileges re-grant anon on every new table). No client path needs what is revoked (proved below). |
| 0202 merchant categories | OK | Bodies match live except the marked lines. Apply before or with the code. |
| 0203 erasure FKs | OK-after-fix | The SQL is sound, but the delete code it supports cannot work until `email_log.to_email` is nullable (F1). Add `ALTER TABLE email_log ALTER COLUMN to_email DROP NOT NULL` here. Counts in the header are stale (F13). |
| 0204 CHECK amount > 0 | OK-after-fix | 0 violators live, but a 23514 poisons the whole sync batch (F3). Do not apply until the sync runner handles 23514 per row. |
| 0205 link FKs | OK-after-fix | Tier order is correct for every live FK except one pre-existing same-level pair (F11); stale-id loop after purge (F10). Apply after the sync deploy. |
| 0206 admin perms / bounds | OK | Apply FIRST (code expects users.notify / users.security and email_suppressions). |
| 0207 cleanup cron | OK | Inert while the flag is false. Apply after 0203; add per-user exception handling (F14). |
| 0208 2FA gate | OK to apply with mode off. DO NOT ENFORCE | Safe for every request while off (analysis below). Enforcing is blocked by F4 and F6. |

Apply order with code dependencies:
1. 0206 (before the code deploy).
2. 0202 (before or with the code).
3. Deploy B3 code (needs F1 fix first).
4. 0203 (+ to_email DROP NOT NULL). Take the qa2_backup copy first.
5. 0207 (after 0203 so anon deletes find no orphan-FK gaps).
6. 0201 (after F2 fix; after the code that stops using client DELETE on profiles/user_settings, none exists today).
7. 0205 (after the sync tier reorder is live in the shipped web bundle; old installed builds retry once).
8. 0204 (after F3 fix and after B2 write guards are verified).
9. 0208 (after code; mode stays off).

## PRIORITY 1: migration 0208 against the live state

Live facts: `authenticator` currently has `pgrst.db_pre_request=private.app_client_gate` (alongside `session_preload_libraries=safeupdate`, `statement_timeout=8s`, `lock_timeout=8s`). `ALTER ROLE ... SET pgrst.db_pre_request` replaces only that one parameter; the others survive. Schema `private` grants USAGE to anon, authenticated, service_role, authenticator, so the hook resolves for every role. `app_client_gate` is `SECURITY DEFINER STABLE`, search_path `public, pg_temp`, fail-open for header/lookup errors, and it keeps raising PGRST 426 for old native builds. `postgres` holds SELECT and REFERENCES on `auth.sessions` and `auth.users` (needed for the FK and for the definer functions). `platform_settings` has one live key (`prices_refresh_attempt`), value is jsonb, no `enforce_2fa_gate` row. Exactly 1 of 45 users has `two_factor_email_enabled`.

Walk-through with mode off:
- `private.db_pre_request` is `SECURITY DEFINER`, called by authenticator/anon/authenticated/service_role (all granted). It calls `app_client_gate()` first, so the update-required behavior is unchanged (its raise propagates, as today).
- `two_factor_gate()` Block A: parses `request.jwt.claims`; anon and service_role return at once. For authenticated it does one PK lookup on `platform_settings`, finds no row or `mode='off'` and returns. Every statement in Block A is inside `exception when others then return`, so a malformed claim, missing table or missing column cannot fail a request. Verdict: cannot break any request with the flag off.
- Cost: one extra definer call, one jsonb parse, one PK lookup per authenticated request (web requests previously skipped the platform_settings read in `app_client_gate`). Negligible now. In enforce mode it adds up to three PK lookups (user_settings, auth.sessions, session_second_factor) per request for 2FA users only; acceptable for one user, revisit before widening (the file already defers this to 0216).
- Ordering inside the file is safe: all functions exist before `ALTER ROLE`; `notify pgrst, 'reload config'` fires at commit.
- Fail-open semantics are as described in the header: Block A fails open, Block B fails closed only in enforce mode.
- Rollback is NOT in the file. Exact rollback: `alter role authenticator set pgrst.db_pre_request = 'private.app_client_gate'; notify pgrst, 'reload config';` then optionally drop `trigger guard_two_factor_flag` and the new functions. Add this to the header.

## Findings

### F1 - blocker - src/lib/server/userData.ts `scrubPersonalText` / email_log (live schema)
`email_log.to_email` is `NOT NULL` (migration 0136, confirmed live). `scrubPersonalText` runs `update email_log set to_email = null` BEFORE deleting the auth user and `deleteUserCompletely` returns `{ok:false,'Failed to remove personal text'}` on any error. Live: 8 email_log rows tied to 5 users; every user who has received a welcome or notification email will get 23502 and cannot delete their account (App Store / GDPR erasure path broken). Unit tests mock the client so they cannot see it.
Fix: ship `ALTER TABLE public.email_log ALTER COLUMN to_email DROP NOT NULL` (put it in 0203, applied before the code) or scrub to a constant such as `'redacted'`; add a pg-level test against the real column.

### F2 - high - 0201 section 1 (trusted_devices) + src/app/api/auth/device/check/route.ts
0201 keeps the own-row SELECT policy on `trusted_devices`. The device id is the only credential of a trusted device (`resolveDeviceId` accepts the `X-Buddget-Device-Id` header from the client). A password-only session (exactly the attacker the 2FA protects against) can `select device_id from trusted_devices` through PostgREST, then call `/api/auth/device/check` with that header: the route answers `trusted:true` and now also calls `record_second_factor(..., 'trusted_device')`, which satisfies the new server gate. Same hole existed for the client-side check; the gate inherits it.
Fix: in 0201 revoke SELECT on `trusted_devices` from authenticated (list devices through the service-role `/api/devices` route that omits `device_id`), or store only a hash of a per-device secret and compare on check.

### F3 - high - 0204 vs src/lib/supabase/remote/sync.ts `OpRunner.upsert`
The 0204 header says a 23514 rejects "that single row and the sync batch is retried per row". The runner only retries per row on 23505; any other code pushes one error and the whole batch (all expenses, or all income events) fails and is retried identically on every flush. One zero-amount row from an old build or an unguarded path blocks every other write to that table indefinitely. Live data is clean (0 rows <= 0 in expenses, income_events, debt_payments; min amounts 50000 / 50000 / 13943), so applying is safe today, the risk is future writes.
Fix: in `OpRunner.upsert` retry per row on 23514 and 23503, report or quarantine the bad row, and add a test. Apply 0204 only after that ships.

### F4 - high (blocks enforce, not apply) - 0208 + client
Nothing in `src/` handles `second_factor_required` / `X-Second-Factor-Required` or calls `second_factor_status`. In enforce mode an unverified 2FA session gets 403 on every PostgREST call with no recovery UI. Also the trusted-device mark is written by `/api/auth/device/check`, which the client calls after sign-in; any PostgREST call racing ahead of it is refused. Do not move past `report` until a shipped build (a) handles the 403 by routing to the OTP step, and (b) awaits device/check before its first sync.

### F5 - medium - 0208 `guard_two_factor_flag` + src/lib/supabase/remote/mappers/settingsMapper.ts:19
`settingsToRow` sends `two_factor_email_enabled` in every settings upsert. A device whose local store is stale (2FA enabled elsewhere) silently turns 2FA off in the database today, and the trigger only prevents that once the gate is not off.
Fix: drop the column from `settingsToRow` (the `/api/auth/two-factor` route is the only writer) or make the trigger unconditional for role `authenticated`.

### F6 - medium - 0208 session verification wiring
`record_second_factor` only inserts when `auth.sessions` has the id and user; on failure the route returns `ok:true, recorded:false` and the client ignores it (`biometricAuth.ts:324` is fire-and-forget `.catch`). A silent failure becomes a lockout the moment the gate enforces. The `amr` allow-list (otp/magiclink/recovery) means a recovery link also passes the gate; acceptable (inbox proof) but document it. Fix: surface `recorded:false`, retry once, and log.

### F7 - medium - src/app/api/auth/password/change/route.ts
(a) `admin.auth.admin.signOut(token,'others')` failure is only logged and the route still returns `{ok:true}`: the user is told other sessions were revoked when they were not. (b) the token for the revoke comes from `accessTokenOf` (cookie `getSession()`), which can be the expired access token while `getUser` succeeded through a refresh; the revoke then fails silently. (c) `scope 'others'` does keep THIS session (correct), and the trusted-device re-upsert is correct, but (d) ALL `biometric_devices` rows are deleted including this device's, so biometric sign-in silently stops working on the device that just changed the password, with no re-enrol prompt.
Fix: return a warning field on revoke failure and retry; use the refreshed token; keep or re-register this device's biometric binding, or show the re-enrol prompt.

### F8 - medium - src/lib/supabase/resolveRouteUser.ts `resolveVerifiedIdentity`
Adds a full `getUser` round trip (`resolveRouteUser`) after local claim verification. Callers that also call `resolveRouteUser` themselves (password/change, two-factor) pay it twice. If Auth is unreachable the helper returns null and every route answers 401 "Not authenticated", which the client may read as "signed out" rather than "try again"; offline-friendly it is not (acceptable for delete/password, but return 503 on network errors, not 401). Rate limits: Auth `getUser` is not heavily limited, but delete/password routes are rare so the cost is fine.
Fix: return `{identity,user}` from one helper; map transport errors to 503.

### F9 - medium - 0201 section 7
Default privileges in `public` (postgres and supabase_admin) grant `arwdDxtm` to anon and authenticated on every FUTURE table. The revoke is a one-time sweep, so the next migration that creates a table silently re-opens anon (RLS becomes the only barrier again, which is what 0201 wants to avoid). Live check: anon has privileges on 54 tables (header says 55). Fix: add `ALTER DEFAULT PRIVILEGES FOR ROLE postgres, supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;` and a CI check that fails on any anon grant beyond asset_prices and merchant_categories.

### F10 - medium - 0205 vs client link ids
`ON DELETE SET NULL` keeps the 90-day purge safe, but the client keeps the stale id locally and re-sends it on the next profile or income write: 23503 forever for that batch (see F3, no per-row retry). Most exposed: `profiles.default_carry_pocket_id` and `active_budget_plan_id` after a pocket or plan is purged. Fix: the F3 per-row retry plus a mapper that nulls a link whose target is not in the snapshot (or the pull reconciling to null).

### F11 - medium - 0205 / sync tiers (live FK audit)
I checked all 61 live FKs between public tables against the new tier order (roots: payment_methods, goals, budget_plans, user_settings; level1: debts, savings_accounts, subscriptions, receipts, holdings, adjustments, budget_categories; level2: income_sources, debt_payments, recurring_*, savings_transactions, budget_subcategories; level3: profiles, income_events, expenses). Every new and existing parent precedes its child EXCEPT `savings_holdings.account_id -> savings_accounts` (both level1, drained in parallel). That FK is live and validated today, so a holding created in the same flush as its new pocket can 23503; it predates B3. Also `debts.linked_credit_card_debt_id` and `payment_methods.parent_id` are self-references inside one batch (fine, one statement). Fix: move `savings_holdings` to level2.

### F12 - medium - 0201 sections 4-6 (checked, no break)
Proof of "no client path": greps show the browser client touches only profiles, user_settings, sms_parse_log, asset_prices, merchant_categories (server cache), sync tables; every revoked table is only reached through `createServiceRoleClient` in `src/app/api/**`, `src/lib/server`, `src/lib/sms`. Invoker functions that touch revoked tables (`get_sms_keyword_pool`, `bump_sms_*`, `learn_sms_sender_currency`) are service-only or become service-only; `ai_cost_usd_micro` is executable by authenticated but only called from definer code (0169). Triggers: the new `b_guard_profile_server_columns` only restores `welcome_email_sent_at` and `data_reset_at` for roles authenticated/anon (service_role route writes in `welcome/route.ts` and `userData.ts` are unaffected); the sync upsert, including the `timezone` column and settings sync, is unaffected because 0201 adds no trigger on user_settings (0208 adds one, see F5). Realtime, auth hooks and PostgREST need only SELECT/INSERT/UPDATE which are kept; service_role, postgres owners keep everything; TRUNCATE/REFERENCES/TRIGGER removal is safe. The two public views (`sms_parse_today`, `app_activity_days`) lose anon, no client use found. Residual: the audit expects 5 policies to drop, confirm with the header query.

### F13 - medium - 0203 header numbers stale
Live `sms_template_users`: 59 rows, 23 orphans, so 36 remain (not 34 as the post-check claims, 57 at plan time). The 30-row guard still passes. No existing triggers on sms_tracking_templates_ai, sms_template_users or email_log, and none of the three FKs or the amount constraints exist yet, so the idempotent guards behave. The cascade delete can only lower `unique_user_count`, it never deletes shared learned templates (`sms_template_users.template_id` cascades from templates, not the reverse). `admin_financial_exclusions.user_id` also has no FK and is not covered. Fix the expected numbers; consider an FK for admin_financial_exclusions.

### F14 - medium - 0207 `cleanup_abandoned_anon_users`
One failing `delete from auth.users` (a NO ACTION FK) aborts the whole weekly run and it repeats the same failure forever. Wrap each delete in `begin ... exception when others then raise warning`. Also apply it after 0203 and watch `private.anon_cleanup_candidates` first as designed (live: 8 anon users, 2 protected).

### F15 - low - 0206 `analytics_touch`
Cap of 60 calls/hour: the client flushes every 120 s and on each hide, so heavy app-switching can exceed it and a dropped call loses its seconds while the client believes it succeeded. Raise to 120 or accept. `api_rate_hit` now deletes on ~2% of hits, matches the live body otherwise (ACL still service_role only; the definer analytics_touch can call it).

### F16 - low - 0206 admin roles
Seeding for admin and support_lead is correct; `admin_roles_guard` only blocks owner changes, so the UPDATE succeeds. support_agent loses push/biometric/password-reset powers by design, confirm that is intended. Code deployed before 0206 would hide those tools from admin and support_lead.

### F17 - low - src/lib/server/email/suppression.ts
Auth-hook mail is exempt from the list (good: a complaint cannot lock someone out of OTP). `email_suppressions` keeps the plain address up to 90 days after account deletion; delete or hash it in `deleteUserCompletely`. Table is service-role only, `email = lower(email)` check matches the writer.

### F18 - low - src/lib/utils/formatters.ts `escapeCsvField`
Plain negative numbers are preserved, dates are unaffected (they start with a digit). But `+5`, `-1,234.50`, `-1e-7` and `-12 EGP` are neither plain numbers nor safe and receive a leading apostrophe, which Excel shows literally. Fix: skip the prefix when `typeof value === 'number'`, and widen PLAIN_NUMBER to allow a leading `+` and an exponent.

### F19 - low - src/lib/utils/exportFile.ts
The native filesystem fallback calls `Filesystem.writeFile` without `encoding`, so Capacitor treats the string as base64 (pre-existing bug, now the BOM goes through it too). Fix: pass `encoding: Encoding.UTF8`.

### F20 - low - android backup files
XML syntax is valid (`full-backup-content` for API <=30, `data-extraction-rules` with cloud-backup and device-transfer for API 31+, valid domains `sharedpref`, `file`, `root`, `database`). But the manifest also sets `allowBackup="false"`, which switches backup off entirely, so the rules are dead weight today (harmless, and a safe default if someone flips the flag). Backups already uploaded by older versions are not deleted.

### F21 - low - src/hooks/useEphemeralSessionGuard.ts
The marker is stale after 2 min with no open tab. On mobile browsers and with Chrome tab discarding, a tab left in the background longer than 2 minutes is frozen, reloads later and signs out a user who never closed the browser; the marker is also global per origin (a second account's sign-in clears it). Sessions that used the old sessionStorage flag become permanent after upgrade. Consider a longer grace (15-30 min) and tracking the user id.

### F22 - low - NativeBootstrap / PushPrePromptSheet
Logic is correct for the three states (granted registers, denied skips, prompt asks; Android below 13 reports granted). Gaps: the sheet uses `ModalShell` directly rather than the prompt-stack registry, so it can stack over another boot sheet; a user who is OS-denied has no path to re-enable inside the app; "later" is written for accounts without an onboarding record with `doneAt`, which marks onboarding done for a brand-new account on the flag-off path.

### F23 - low - admin guards
`allowUserAction` consumes the quota before the op validates, so failures burn it, and the per-target hourly cap lets one staff member exhaust it for everyone (e.g. 2 password resets per hour). `allowAttempt` fails closed (good) but `auditPiiRead` silently skips the audit when the rate RPC errors. `user.notify` audit now stores the message body (personal text in the log). `recordFailure` is race-safe but verification still runs in parallel before the counter, so N parallel guesses are all checked; returns `locked:false` after 5 lost CAS rounds.

### F24 - low - account delete route
207 with `{ok:false,deleted:true,partial:true}` is read as success by the client (`res.ok` is true for 207), so the user sees the deletion screen; fine. Avatar removal and the text scrub happen before `deleteUser`, so a failed `deleteUser` leaves a half-scrubbed account (comment says nothing is half-gone).

## Notes that need no action
- 0202: all three rewritten function bodies equal the live definitions except the marked lines; `record_sms_template_signal` ownership guard works for both expenses and income_events triggers; two-user corroboration is Sybil-able by one person with two accounts (accepted risk).
- Live `api_rate_hit`, `admin_rate_hit`, `cleanup_*` ACLs are service_role-only, so the 0207 cron jobs run as postgres and work.

## Fix status
FIXED: F1 (0203 DROP NOT NULL + code writes '[erased]' placeholder), F2 (0201 revokes SELECT on trusted_devices), F3 (OpRunner retries per row on 23505/23514/23503, test), F4 (0208 header + rollback), F5 (settingsToRow drops two_factor_email_enabled, test), F7 (502 sessions_not_revoked after one retry, test; biometric rows stay cleared per decision doc), F9 (0201 default privileges revoke for anon), F10 (isolated by F3 per-row retry), F11 (holdings moved to level2, test), F13 (0203 numbers), F14 (0207 per-row exception), F15 (cap 120), F18 (CSV numbers), F19 (UTF8 encoding).
DEFERRED: F6, F8, F17, F20-F24 (client/UX or larger changes; F20 harmless). F12 no action.
