# S8c: QA round 2, API, database and security

2026-11-19. Live Frankfurt project `tzioppxwsljhlglyducm`, app on `next dev -p 3100` (`NEXT_PUBLIC_DEV_AUTH_BYPASS=0`, no API base URL). Synthetic users only: `qa-api-1..3` (A, B, C) and, for the legacy `e2e/security/api-probe.mjs`, `qa-sec-1..3`. All six were deleted at the end; a check afterwards found 0 rows for their ids in auth.users, profiles, expenses, payment_methods, savings_accounts, sms_ingest_tokens, paywall_views, support_tickets, user_entitlements, user_devices, notifications and sms_parse_log. Report only; no app code or schema was changed.

QA-28 and QA-29 (no password lockout, leaked-password check off) showed up again in `api-probe brute` and `get_advisors`. Both are accepted on the Free plan and are not re-filed.

## Counts

| Run | Requests or tests | Result |
|---|---|---|
| `e2e/api/auth-matrix.mjs` | 262 (66 routes x none / garbage / tampered / forged-sub) | 0 bypasses. Every user route 401; public routes as designed; webhooks 503 (not configured locally) |
| `e2e/api/input-matrix.mjs` | 216 (36 routes x 6 bad bodies) | 0 x 500. 400 x 170, 413 x 5 |
| `e2e/api/cross-user.mjs` | 7 | Holds (B's notification unread, B's device untouched) |
| `e2e/api/nan-probe.mjs` | 6 | `payment_methods.opening_balance = 'NaN'` accepted (S8C-01). The expense and income cases are stale (bad enum value, missing column) and were redone in round2 |
| `e2e/api/money-rpc.mjs` | 5 groups | Idempotency, floor and inputs hold. "debt remaining 1000, expect 900" is a stale expectation: `remaining_amount` is legacy (`debtMapper.ts:60` writes null; the app derives it from payments) |
| `e2e/api/concurrency.mjs` edges, checkemail, trial, biometric | 4 steps | Hold. `checkemail` showed no 429 because the 35 calls straddled two 60 s buckets (18 + 22), not a bug; round2 aligns to the window. `paywall` (40 parallel) and `setuptoken` (old GET) were not run: the first floods past the limit, the second is replaced by round2 |
| `e2e/security/api-probe.mjs` rls, 2fa, net, ttl, brute | 5 steps | RLS, 2FA gate, `net` schema hidden, ES256 tokens with a 3600 s TTL all hold. `revoke-1/2` skipped: they write a JWT to a path derived from `QA_PW_FILE` (only safe when that file is named `qa_pw.txt`); the same check is QA-30 in round2 |
| 2FA-pending session on 10 app routes (ad hoc, qa-sec-3) | 10 | All 403 `second_factor_required` |
| `types-drift.py` (live vs `database.types.ts`) | 119 tables, 5 views, 204 functions | No drift |
| `scan-queries.py` | 102 flags | Mostly admin routes or false positives; see S8C-07 |
| `coverage.py` | 116-line table | Written to the scratchpad, not committed |
| **`e2e/api/round2/` (new, Playwright API mode)** | **41 tests** | **41 pass**; 5 of them are `test.fail` known bugs S8C-01 to S8C-05 |
| `EXPLAIN` (no ANALYZE) | 2 | Both use an index (`idx_expenses_subscription`, `idx_sms_templates_sender_pattern`) |

## QA ticket regression status

Every ticket has a permanent test in `e2e/api/round2/` (file `qa-regressions.spec.ts` unless noted).

| Ticket | Status | Evidence |
|---|---|---|
| QA-17 rate-limit bucket | Pass | Live `api_rate_hit` uses `floor(epoch / window)`. A burst aligned to a fresh minute gets its first 429 after at most 30 x 200 |
| QA-30 revoked session on PostgREST | Pass | After `/auth/v1/logout`, the same JWT gets 401 `session_revoked`; a second live session of the same user still gets 200. App API routes: see S8C-02 |
| QA-51 null and wrong-typed bodies | Pass | 0 x 500 in 216 bad-body requests; the targeted null and typed cases answer 400 (paywall-view 200 by design) |
| QA-52 paywall-view limit | Pass | 22 calls: at most 20 `recorded:true`, then `recorded:false` |
| QA-53 deleted account writes | Pass, with a gap | Deleted C gets 401 on feedback, vote, paywall-view, setup-token and trial (`zz-lifecycle.spec.ts`); reads stay 2xx by decision. Gap: support/submit, S8C-05 |
| QA-54 biometric without a device id | Pass | 404, no `Set-Cookie` |
| QA-55 error shapes | Pass (closed with QA-51) | No empty 500s |
| QA-56 public deep health | Pass | Public body is exactly `{ok, degraded}` |
| QA-57 Linear outbox | Pass | `integration_outbox` is empty; health no longer checks it; a user JWT on `cron/integrations` gets 401. `degraded:true` locally is the missing `CRON_SECRET`, not Linear |
| QA-58 admin leads cursor | Pass (auth side) | A non-admin token gets 401/403 with or without a cursor; the cursor logic itself is covered by the route unit test |
| QA-59 trial_claims email | Pass | 0 rows with `@` in `email_key`. Whether it is the keyed hash or the SHA-256 fallback depends on `TRIAL_CLAIM_KEY_SECRET` in Vercel (S10 gate 2), which this session cannot see |
| QA-60 NaN money | Partial | expenses, income_events, debt_payments, savings_accounts and savings RPCs refuse NaN, Infinity and 1e20. `payment_methods` (S8C-01) and `debts` (S8C-03) do not |
| QA-61 migration ledger | Pass | `supabase/migrations/README.md` "The folder is the record (QA-61" |
| QA-62 savings dates | Pass | 2999-01-01, 1999-12-31 and 2100-01-01 get 23514; 2000-01-01 is accepted. Other tables: S8C-04 |
| QA-98 link columns | Pass | A's goal with B's pocket id, A's expense with B's `sms_log_id` or `retracted_by_sms_log_id`, and A's income with B's pocket all get 23503; an unknown id is still accepted |
| QA-99 check-email | Pass | Per-minute cap holds at runtime; the day cap and fail-closed behaviour are covered by `check-email/route.test.ts` |
| QA-100 CSP | Pass | `/login` and `/dashboard` pin the project origin, with no `*.supabase.co` and no bare `https:` images; `/admin` keeps `https:` by decision. The marketing site (`src/lib/site/entry.ts:41`) has its own CSP with `img-src https:`, outside the ticket's scope |
| QA-101 net.* | Pass (accepted platform default) | `Content-Profile: net` gets 406 PGRST106 |
| QA-102 setup-token GET | Pass | No Bearer: 405 with `Allow: POST`; POST with Bearer: 200 with `Cache-Control: no-store` |

## Findings

Severity: High = cross-user or money corruption reachable now; Medium = auth weakness with a real path; Low = data quality or hygiene; Info = no action needed.

### S8C-01 · Low · money · for Fable review: `payment_methods.opening_balance` accepts NaN
- **Repro:** as A, `POST /rest/v1/payment_methods` with `{"name":"qa","type":"cash","currency":"EGP","opening_balance":"NaN"}` returns 201. `rpc/sync_pull_v2` then returns a body containing `NaN`; `balance_view` on that account answers `{"status":"empty"}`. 1e15 is refused (numeric 14,2 overflow), so only NaN gets through.
- **Root cause:** 0323 added the NaN/range CHECKs to five tables (expenses, income_events, debt_payments, savings_transactions, savings_accounts); `payment_methods` has only label, last4 and parent checks. Postgres numeric accepts `'NaN'` and NaN passes a `>= 0` comparison.
- **Test:** `qa-regressions.spec.ts` "S8C-01" (`test.fail`).

### S8C-02 · Medium · auth · for Fable review: a revoked session still passes every app API route, including writes
- **Repro:** sign in A (session 1), `POST /auth/v1/logout?scope=local` with that token (204). PostgREST now answers 401 `session_revoked`. The same JWT on the app API: `POST /api/sms/setup-token` 200 (a new **non-expiring** ingest token), `POST /api/entitlements/trial` 200 `granted`, `POST /api/billing/paywall-view` 200, `GET /api/notifications` 200.
- **Impact:** a stolen access token outlives logout, a password change or a device removal for up to the 1 h token lifetime on the app routes. Through setup-token it turns into a credential that never expires and survives the JWT's expiry (until the device or token is revoked).
- **Root cause:** QA-30 put the `auth.sessions` check in PostgREST's `db_pre_request` only. App routes verify the JWT locally (`resolveApiUserId`) or ask Auth for the user (`resolveActiveApiUserId`), and neither looks at the session. QA-53 kept reads local on purpose; writes that mint long-lived credentials (setup-token, rotate, biometric register, device trust) were not singled out.
- **Test:** `adversarial.spec.ts` "S8C-02" (`test.fail`).

### S8C-03 · Low · money · for Fable review: `debts.amount` accepts NaN
- **Repro:** as A, `POST /rest/v1/debts` with `"amount":"NaN"` returns 201. 1e15 is accepted too.
- **Root cause:** same gap as S8C-01; `debts` was not in 0323's table list.
- **Test:** `adversarial.spec.ts` "S8C-03" (`test.fail`).

### S8C-04 · Low · data quality: expense, income and debt-payment dates have no bound
- **Repro:** as A, an expense dated 2999-01-01, an income event dated 1900-01-01 and a debt payment dated 2999-01-01 are each accepted (201).
- **Root cause:** QA-62 was scoped by decision to `savings_transactions` only. A far-future row sits in every monthly total until edited. Raise only if the owner wants the same 2000 to 2100 bound elsewhere.
- **Test:** `adversarial.spec.ts` "S8C-04" (`test.fail`).

### S8C-05 · Low · auth · for Fable review: support/submit from a deleted account answers 500
- **Repro:** delete C via `/api/account/delete`, then with C's still-unexpired JWT `POST /api/support/submit {"chosen":"question","title":"..."}` returns 500 `Could not send that. Try again.`. Server log: `insert or update on table "support_tickets" violates foreign key constraint "support_tickets_user_id_fkey"`. No row is stored.
- **Root cause:** QA-53 kept support open to suspended accounts with the local `resolveApiUserId`; for a deleted account the RPC then fails on the FK and the route maps it to a 500 instead of a 401.
- **Test:** `zz-lifecycle.spec.ts` "S8C-05" (`test.fail`).

### S8C-06 · Info · billing: the selling switch is ON on the live project
- `public.billing_enabled()` returns true (`platform_settings.billing.enabled`). The brief assumed it was off. With it on, `paywall-view` records views and `entitlements/trial` grants a 30-day Plus trial (one per account; 12 parallel claims granted exactly one). Not changed here. The owner should confirm this is intended before the S5c Terms-notice step.

### S8C-07 · Low · database load: `cron/notifications` makes per-user queries inside each page
- `src/app/api/cron/notifications/route.ts:143` (expenses linked to the user's subscriptions, `select('*')`) and `:180` (goals, runs, accounts) run once per due user inside the cursor-paged loop, against CLAUDE.md's "never one query per user" rule. Each query is indexed (`EXPLAIN`: `idx_expenses_subscription`), so this is cost per user rather than a scan. Also `select('*')` in `carryCycle.ts:73-77`, `devices/route.ts:34` and `devices/registry.ts:62`. For S8d to measure.

### S8C-08 · Low · test harness: `e2e/api/lib.mjs` redaction misses UUID tokens
- `redact()` masks JWTs, emails and hex strings of 32+ characters, so a UUID ingest token passes through: `cross-user.mjs` printed A's setup token in clear (synthetic user, revoked at teardown). The round2 specs never print bodies. Suggest adding a UUID pattern to `REDACT`, or printing only status for token routes.

### Info, no action
- `user_devices` has no SELECT grant for `authenticated` (devices go through `/api/devices`), which is stricter than RLS. Device ids are client-chosen and scoped per user: A may hold a row with the same device-id string as B, and `PATCH`/`DELETE /api/devices/<id>` then act on A's own row only. B's row was verified unchanged.
- `bump_sms_sender`, `bump_sms_keyword` and `learn_sms_sender_currency` are executable by `authenticated` but are SECURITY INVOKER on tables with no grant, so every call fails with 42501. Revoking EXECUTE would tidy the API surface.
- `sync_table_delta` builds SQL from an allowlist with `%I`/`%L`; an injection-shaped table name is refused.
- `get_advisors`: 25 user-facing SECURITY DEFINER functions (all check `auth.uid()`; the IDOR probes against them held), `pg_net` in public (QA-101), leaked-password check (QA-29), 44 unused indexes (INFO).
- Rate limits verified a couple of requests past each limit: check-email 30/min, biometric 10 per device per 10 min, savings/carry 20/min, paywall-view 20/h. Local servers all report `127.0.0.1`, so parallel cloud sessions share IP buckets in dev; production uses `x-real-ip`.
- Not covered: a JWT that has naturally expired (it would need an hour-long wait; a tampered `exp` fails on the signature, covered by the auth matrix); RevenueCat webhook signatures (not configured locally, 503).

## Suite

`e2e/api/round2/` (see its README). `setup.mjs` creates A, B and C with B's seed rows (`--legacy-sec` adds qa-sec-1..3); `teardown.mjs` deletes them all. `zz-lifecycle.spec.ts` deletes C, so run `setup.mjs` before each run.
