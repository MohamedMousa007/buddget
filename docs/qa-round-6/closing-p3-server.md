# Round 6 closing: P3 server pass (db-security, db-integrity, auth-attack, sec-static, sec-logic)

Status: COMPLETE. Every assigned ID has a status below. Verification: vitest over src/app/api, src/lib/server, src/lib/supabase, src/lib/legal, src/lib/integrations = 110 files / 616 tests pass (6 skipped = DB-backed .pg tests); `tsc --noEmit` clean; eslint 0 errors on touched files. Rolled-back SQL probes: `repro/closing-p3-server/probes.sql.txt`.

## Migrations
| File | State | Content | Rolled-back probe result |
|---|---|---|---|
| 0250_p3_grants_link_guards_profile_email.sql | APPLIED LIVE (verified: default ACLs, column grants, triggers read back) | DBS-5 (biometric_devices SELECT on every column except `secret_hash`), DBS-9 (global default privileges: no PUBLIC/anon/authenticated EXECUTE on new functions, service_role keeps it), DBS-10, SST-8, DBS-2 remainder (`assert_link_owner` learns `profiles`; guards on account_adjustments, buddgy_memories, budget_categories/feedback/plan_activations/subcategories, profiles, expenses.refund_sms_log_id), SST-12 (`a1_pin_profile_email`: client sessions always get the Auth email) | email forced to auth address; foreign plan on profiles/activation = 23503, own = ok; `secret_hash` = 42501, device list and own DELETE still work; site_leads = 42501; goal_allocation_runs insert = 42501, select ok; new function ACL = postgres+service_role only |
| 0251_p3_housekeeping_guards_2fa_failclosed.sql | APPLIED LIVE | DBI-2 (plan delete tombstones its activations), DBI-6 (`private.tombstone_purge_guard`: housekeeping keeps savings_transactions referenced by a live expense/debt payment, and recurring_expenses referenced by a live subscription), DBI-3 (sms_retention never deletes a failed parse-log row a user row points at), DBS-7 (two_factor_gate raises in enforce mode on a failure after the mode is known), DBI-10 (COMMENT) | activation tombstoned = 1; referenced tombstone kept, unreferenced purged; sms_retention runs; enforce + malformed claim = raised (was skipped), service_role and user-without-2FA = pass. Flag stays `report` (the enforce update was inside the rolled-back probe) |
| 0252_p3_data_repairs_NOT_APPLIED.sql | NOT APPLIED (owner) | see file: DBI-2 stale activation, DBI-3 two orphan pointers, DBI-4, DBI-5 + unique index, AUT-6 legacy trusted row | n/a |
| 0253 | unused | | |

DBS-6 cannot be fixed from SQL: `net` is owned by supabase_admin, USAGE/EXECUTE for PUBLIC, anon and authenticated are platform grants, `postgres` has no grant option and `SET ROLE supabase_admin` is refused. Exposure stays closed (PostgREST exposes `public, graphql_public` only).

## Per ID (server-side DB items done so far)
DBS-2 Fixed (0244 + 0250). DBS-5 Fixed. DBS-6 Won't fix (platform-owned). DBS-7 Fixed (fail-closed in enforce; platform flag untouched). DBS-9 Fixed. DBS-10 Fixed. DBS-8 / AUT-5 / SST-9 Owner decision (Auth dashboard setting, needs the Pro plan, no SQL/API path). DBI-2 Fixed (trigger) + repair NOT APPLIED. DBI-3 Fixed (guard) + repair NOT APPLIED. DBI-6 Fixed (housekeeping guard, not FKs: sync pushes tables in arbitrary order so an FK would park legitimate offline rows). DBI-8 Already fixed (0244). DBI-10 Fixed (decision: keep nullable, mark deprecated; installed builds still send `remaining_amount: null`, dropping the column would make PostgREST reject every debt upsert; code never reads it). SST-8 Fixed. SST-12 Fixed. SLG-8 Already fixed (`ai_quota_reserve_v2` since 0224 counts in-flight receipt/voice reservations; the app calls v2). SLG-6 Fixed (policy says Singapore, EN+AR).

## Per ID, all 40 (Fixed / Already fixed / Won't fix / Owner decision)
| ID | Status | What and test |
|---|---|---|
| DBS-2 | Fixed | 0244 + 0250 guards on every user-writable link column (profiles supported); probe: foreign plan = 23503 |
| DBS-5 | Fixed | 0250; probe: `secret_hash` 42501, own DELETE still works |
| DBS-6 | Won't fix (platform) | `net` is supabase_admin-owned; postgres cannot revoke, SET ROLE refused; exposure closed by PostgREST schema list. Ask Supabase support if the owner wants it |
| DBS-7 | Fixed | 0251: enforce mode raises on a malformed claim (probe); flag untouched (report) |
| DBS-8 | Owner decision | Auth leaked-password protection: dashboard toggle, Pro plan, no API (same as AUT-5, SST-9) |
| DBS-9 | Fixed | 0250 global default privileges (per-schema revoke cannot remove PUBLIC); probe: new function ACL = postgres + service_role; note in `supabase/migrations/README.md` |
| DBS-10 | Fixed | 0250; probe: site_leads 42501 |
| DBI-2 | Fixed | 0251 trigger (probe) + 1 stale row in 0252 NOT APPLIED |
| DBI-3 | Fixed | 0251 retention guard (clause run live) + 2 orphan pointers in 0252 NOT APPLIED |
| DBI-4 | Owner decision | 0252 NOT APPLIED clears the flag on 3 legacy rows; linking them to a debt needs the owner |
| DBI-5 | Owner decision | 0252 NOT APPLIED: merge 5 duplicate payment methods + partial unique index (index would park a legitimate offline duplicate push) |
| DBI-6 | Fixed (guard, not FKs) | 0251 `tombstone_purge_guard` in housekeeping (savings_transactions, recurring_expenses); FKs rejected because sync pushes tables in arbitrary order; probe |
| DBI-7 | Won't fix | transient (3 of ~3,050 runs, coincided with QA load); nothing to change |
| DBI-8 | Already fixed | 0244 |
| DBI-9 | Fixed | Vercel entry removed from `vercel.json` (pg_cron job 15 stays); `cronSchedule.test.ts` |
| DBI-10 | Fixed (decision: keep, deprecate) | code never reads it, mapper writes null for installed builds; dropping would break their debt upserts; COMMENT in 0251 |
| AUT-3 | Already fixed | 0244 |
| AUT-4 | Fixed | `freshHook(stamp, now, eventTime)`: no stamp needs a signed event time within 1 h; `sentryWebhook.test.ts`, `webhooks/sentry/route.test.ts` |
| AUT-5 | Owner decision | see DBS-8 |
| AUT-6 | Fixed | `device/check` never trusts a legacy row by id (user verifies once, `/trust` re-issues); route test; row delete optional in 0252 |
| AUT-7 | Fixed | `lib/server/clientIp.ts` (x-real-ip, else last forwarded hop) used by proxy, check-email, biometric/signin, site/event, site/lead, health/deep, admin guard; `clientIp.test.ts` |
| AUT-9 | Fixed (Secure; HttpOnly not possible) | `authCookieOptions` + Secure on domain and marker cookies in client, server, proxy; HttpOnly would break the browser client that reads the cookie via document.cookie; `cookieDomain.test.ts` |
| AUT-10 | Fixed | account/delete returns codes and counts only, details logged; route test |
| AUT-11 | Won't fix (design) | enumeration by check-email is required by the sign-up/reset forms; limited per IP, now with a spoof-proof IP (AUT-7) |
| AUT-12 | Owner decision | biometric sign-in counting as inbox proof for 10 min is documented in the code; password-required alternative is a UX call |
| SST-3 | Fixed | Sentry user id kept only when the device tag is registered to that account; route test |
| SST-4 | Owner decision | enabling R8 cannot be verified without a native build (not allowed here); needs keep rules for Capacitor/Firebase/SMS plugins and a device run |
| SST-6 | Already fixed | `capacitor.config.ts` is opt-in (`CAP_WEBVIEW_DEBUG=1`) |
| SST-7 | Fixed | with AUT-9 |
| SST-8 | Fixed | 0250 revokes; probe: insert 42501, select ok |
| SST-9 | Owner decision | see DBS-8 |
| SST-10 | Fixed | with AUT-7 |
| SST-11 | Fixed | `tokenCaps.ts`: newest 20 push tokens, 5 retired ingest tokens, rotation 10/h; `devices/tokenCaps.test.ts` |
| SST-12 | Fixed | 0250 `a1_pin_profile_email`; probe: forged email replaced by the Auth address |
| SLG-5 | Fixed | `writeAudit` returns ok; export audits BEFORE reading and refuses (503) when the row cannot be written; same refusal on `pii.sms.reveal` and `pii.financial.read`; `export/route.test.ts` |
| SLG-6 | Fixed | policy says Singapore (Supabase ap-southeast-1, Vercel sin1), EN+AR, transfer paragraph too; `legal/privacyClaims.test.ts` |
| SLG-7 | Fixed (policy matched to code) | 60-day cap for unconfirmed messages and recurring corpus patterns stated EN+AR; deleting popular masked patterns would hurt parsing; test above. The 172 learned rows past 30 days: re-check `sms_retention_audit` after the next run |
| SLG-8 | Already fixed | `ai_quota_reserve_v2` counts in-flight receipt/voice reservations since 0224, the app calls v2 |
| SLG-9 | Fixed (rate limit; hash rejected) | 1200/h per user on `sms/parse`, fail-open; test in `parse/route.test.ts`. Token hash at rest still rejected (setup-token must return the stored token, see closing-security) |
| SLG-10 | Fixed | comment corrected (live index is (user_id, token)); possession model stated |
| SLG-11 | Won't fix | cost only (seven small reads per new user until the first cycle closes), the cron moves money and has no harness; risk exceeds benefit |
| SLG-12 | Already fixed + Fixed | NOTIFICATION_LISTENER.md and ADMIN_PORTAL.md already corrected; the policy no longer claims notification ingest (EN+AR, test) |

## Owner list
1. Run or reject `supabase/migrations/0252_p3_data_repairs_NOT_APPLIED.sql` (blocks are independent).
2. Auth dashboard: enable leaked-password protection (DBS-8/AUT-5/SST-9).
3. Decide SST-4 (R8 with a device run) and AUT-12 (password for 2-step off / password change after biometric sign-in).
4. Heads-up (0250): new SQL functions need an explicit `GRANT EXECUTE` for client RPCs.
