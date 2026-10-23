# Admin platform: review of the master plan, and what is built

Companion to the owner's `ADMIN_PLATFORM_MASTER_PLAN.md` (7 phases, decisions locked 2026-10-23). This file records what I verified against the repo and the live database (`ydihurtbcnoflhormgzi`), what the plan got wrong or missed, the order I am building in, and what only the owner can do.

## 1. Verified as stated

| Plan claim | Result |
|---|---|
| No ticket is ever created by the app (`source = 'in_app'` unused) | Confirmed: nothing in `src/` writes it. `/api/feedback` posts straight to Linear. |
| Advisors: 30 tables "RLS enabled, no policy" | Confirmed (INFO, intentional: service-role-only tables). |
| `app_client_gate()` executable by `anon`; 11 SECURITY DEFINER functions executable by `authenticated`; leaked-password protection off | Confirmed, same counts. |
| The SMS log panel can show message content | Confirmed, and worse than the plan guessed: see 2.2. |
| Unmasked identity is behind `users.pii` | Confirmed (`maskIf`, `canSeePii`). |

## 2. Corrections and gaps in the plan

### 2.1 Do NOT revoke `anon` execute on `app_client_gate` (plan 4.4 step 6, Phase 0)
`authenticator` has `pgrst.db_pre_request = public.app_client_gate`. PostgREST calls it before every request, as the calling role. Revoking `EXECUTE` from `anon` would make every signed-out request fail with a permission error, and a mistake on `authenticated` would break the whole app. The advisor flags it because it is SECURITY DEFINER and reachable over `/rest/v1/rpc/`, but the body only reads `min_app_version` and either returns or raises the 426 update-required response. **Decision: accept this warning, document it, and do not touch the grants.** The 11 `authenticated` SECURITY DEFINER warnings are the app's own RPCs (savings deposits, subscriptions, debt payments); each must keep its `auth.uid()` ownership check, which is a code review item, not a revoke.

### 2.2 The raw SMS body is gated by the wrong permission (plan 4.1 open question)
`/api/admin/sms/logs` returns `raw_body` to anyone with `users.pii` (support lead, admin), and "create ticket" copies the body into the ticket message for the same people. That is T3 content (bank messages contain balances and merchants) behind a T2 permission, with no reason and no per-read audit row. Built in this pass: a separate `users.financial` permission, masked bodies in lists, and a per-message reveal that needs a reason and writes an audit row (section 4).

### 2.3 Missed advisor findings
The advisor also reports about 40 "anonymous access policies" (lint 0012). Checked: only **11** of those policies really apply to every role (`biometric_devices`, `push_tokens`, `receipts`, `sms_ingest_tokens`, `sms_parse_log`, `sms_template_signals`); they return nothing to `anon` because `auth.uid()` is null, so this is hygiene. Prepared as `0163_policies_authenticated_only.sql`, **not applied** (owner sign-off first). The rest are flagged because their policies target `authenticated`, which anonymous sign-ins would also hold: that is a question about the Auth setting, so the owner should confirm **"Allow anonymous sign-ins" is off** in Supabase Auth (the app has no guest mode). The `service_role_only` policies are already safe (`auth.role() = 'service_role'` or `false`).

### 2.4 Other review notes
- **Sentry, uptime vendor, compute size, MFA, removing org members, leaked-password protection** are owner actions. I cannot do them from code; Sentry needs a DSN handed over as an env var, and adding `@sentry/nextjs` also changes the build and the static native export, so it waits for the account.
- **GitHub Actions is currently blocked by billing** ("recent account payments have failed or your spending limit needs to be increased"). CI and both native release workflows fail in 2 to 3 seconds without running. This is itself a Phase 0 reliability finding: the plan has no alert for "CI cannot run".
- **`cron.job_run_details` shows 0 retained rows**, so the plan's "dead-man heartbeats" cannot lean on it; heartbeats must be written by the jobs.
- **Phase 4 settle path**: the plan puts cost capture inside the existing settle step. `reserveAiQuota`/`settleAiQuota` are called per AI request from routes, so adding a price lookup there must be a cached read (one row per model), never a query per call.
- **Phase 3 raw events table** must come after the compute upsize, as the plan says; I will not ship it before the owner confirms the upsize.
- **Linear outbox** (Phase 2) depends on the `linear` MCP/API token, which needs the owner's authorization.

## 3. Build order (what I can do without the owner, in this order)

1. **Phase 0 (code only):** `GET /api/health` and `/api/health/deep`, runbook stubs, hardening migration prepared (not applied), dead-man heartbeat helper for cron routes.
2. **Phase 1 (first slice):** T3 split for raw SMS (`users.financial`, masked lists, audited reveal with reason), permission catalog additions, new system roles prepared as a migration.
3. Per-phase docs under `docs/admin-platform/` (exact migrations, routes, tests, rollback) for Phases 2 to 6, written before any feature code, as the plan asks.

## 4. Built in this pass

- `GET /api/health` (shallow: up, version, build) and `GET /api/health/deep` (one cheap DB read and one cache read, rate limited, no secrets).
- `users.financial` permission (granted to `admin`; the owner holds everything). Without it a staff member never sees an SMS body. With it, bodies are still masked in lists; revealing one needs a reason (min 8 characters), is rate limited, and writes `pii.sms.reveal` to the audit log with the log id and reason. "Create ticket" no longer copies the body unless the actor holds the permission.
- Break-glass grants (Phase 1): table `admin_access_grants`, SQL checks `admin_has_grant` and `admin_user_financial_snapshot` (migration 0164, applied), `POST/GET /api/admin/users/[id]/financial` (request, approve, extend, revoke, read), a *Financial* tab on User 360, audit rows `pii.financial.*`, and a notification line in the user's own feed on each read.
- Migration `0162_staff_financial_permission.sql` (applied: grants the new permission to `admin`) and `0163_policies_authenticated_only.sql` (written, not applied).

## 5. Owner checklist (cannot be done from code)

1. Fix the GitHub billing / spending limit so CI and native builds can run.
2. Create the Sentry and uptime-vendor accounts and hand over the keys as env vars.
3. MFA on Supabase, Vercel, GitHub, Google Cloud, Apple, Google Play, Linear; remove other Supabase org members; rotate the `service_role` key.
4. Choose the compute size, then I take the `pg_stat_statements` baseline and reset it.
5. Turn on leaked-password protection (Supabase Auth settings).
6. Review and approve `0163_policies_authenticated_only.sql` before it is applied, and confirm anonymous sign-ins are off.
