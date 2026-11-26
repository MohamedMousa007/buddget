# W1a Inventory: buddget (read-only)

Worktree: `claude/buddget-audit-68c548`. Facts only; no files changed except this output. `.env*` files not read. No tests, builds or dev servers run.

## 1. API routes

117 route files under `src/app/api/**`. Class counts: main-app 43, admin 45, public-site 8, auth 9, cron 9, webhook 3.
Auth column = first matching check name in the first 60 lines of the file ("—" = no check name matched; the route may use an imported helper, verify before relying on it).

| Route file (src/app/api/) | Methods | Class | Auth hint |
|---|---|---|---|
| account/delete/route.ts | POST | main-app | resolveRouteUser,Bearer,reauth_required,REAUTH_WINDOW_SECONDS |
| admin/access/route.ts | GET | admin | guardAdmin,guard |
| admin/ai/cost/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/analytics/onboarding/route.ts | GET | admin | guardAdmin,guard |
| admin/analytics/route.ts | GET | admin | guardAdmin,guard |
| admin/audit/route.ts | GET | admin | guardAdmin,guard |
| admin/auth/biometric/device/route.ts | POST,DELETE | admin | guardAdmin,guard |
| admin/auth/biometric/route.ts | POST | admin | timingSafeEqual,guardSignIn,guard |
| admin/auth/code/route.ts | POST | admin | guardAdmin,guardSignIn,guard |
| admin/auth/login/route.ts | POST | admin | guardSignIn,guard |
| admin/auth/logout/route.ts | POST | admin | guardAdmin,guard |
| admin/auth/password/route.ts | POST | admin | guardAdmin,guard |
| admin/auth/sessions/route.ts | GET,DELETE | admin | guardAdmin,guard |
| admin/auth/setup/confirm/route.ts | POST | admin | guardSignIn,guard |
| admin/auth/setup/route.ts | POST | admin | guardSignIn,guard |
| admin/auth/status/route.ts | GET | admin | guardAdmin,guard |
| admin/crashes/route.ts | GET,POST | admin | guardAdmin,guard,Guards |
| admin/emails/log/route.ts | GET | admin | guardAdmin,guard,Guards |
| admin/emails/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/emails/setup/route.ts | GET | admin | guardAdmin,guard |
| admin/flags/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/leads/route.ts | GET | admin | guardAdmin,guard,Guards |
| admin/loyalty/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/overview/route.ts | GET | admin | guardAdmin,guard |
| admin/plans/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/platform/route.ts | GET,PATCH,POST | admin | guardAdmin,guard |
| admin/rewards/switches/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/sms/health/route.ts | GET | admin | guardAdmin,guard |
| admin/sms/logs/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/sms/pattern-review/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/sms/promotion/route.ts | POST | admin | guardAdmin,guard |
| admin/sms/push-health/route.ts | GET | admin | guardAdmin,guard |
| admin/sms/queue-health/route.ts | GET | admin | guardAdmin,guard |
| admin/sms/templates/route.ts | POST | admin | guardAdmin,guard |
| admin/staff/route.ts | GET,POST | admin | guardAdmin,guard,Guards |
| admin/support/macros/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/support/summary/route.ts | GET | admin | guardAdmin,guard |
| admin/support/tickets/[id]/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/support/tickets/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/users/[id]/activity/route.ts | GET | admin | guardAdmin,guard,Guards |
| admin/users/[id]/export/route.ts | POST | admin | guardAdmin,guard |
| admin/users/[id]/financial/route.ts | GET,POST | admin | Guards,guardAdmin,guard |
| admin/users/[id]/rewards/route.ts | GET,POST | admin | guardAdmin,guard |
| admin/users/[id]/route.ts | GET,POST | admin | guardAdmin,guard,Guards |
| admin/users/[id]/sms/route.ts | GET | admin | guardAdmin,guard |
| admin/users/route.ts | GET | admin | guardAdmin,guard,Guards |
| ai/route.ts | POST,GET | main-app | — |
| analytics/onboarding/route.ts | POST | main-app | — |
| app-config/route.ts | GET | public-site | — |
| auth/check-email/route.ts | POST | auth | — |
| auth/device/check/route.ts | POST | auth | resolveRouteUser |
| auth/device/trust/route.ts | POST | auth | resolveRouteUser |
| auth/email-hook/route.ts | POST | auth | signature |
| auth/password-updated/route.ts | GET | auth | — |
| auth/password/change/route.ts | POST | auth | resolveRouteUser,Reauth,reauth,reauth_required |
| auth/second-factor/route.ts | POST | auth | resolveRouteUser |
| auth/two-factor/route.ts | POST | auth | resolveRouteUser,Reauth,reauth,reauth_required |
| auth/welcome/route.ts | POST | auth | resolveRouteUser |
| billing/paywall-view/route.ts | POST | main-app | — |
| billing/revenuecat/route.ts | POST | main-app | Authorization,signature,authorization |
| billing/stay-offer/route.ts | GET,POST | main-app | — |
| billing/sync/route.ts | POST | main-app | Authorization,Bearer |
| biometric/register/route.ts | POST,DELETE | main-app | resolveRouteUser,Reauth,reauth,REAUTH_WINDOW_SECONDS,reauth_required |
| biometric/signin/route.ts | POST | main-app | timingSafeEqual |
| buddgy/turn/route.ts | POST | main-app | signature |
| buddgy/usage/route.ts | GET | main-app | — |
| budget/ai/route.ts | POST | main-app | — |
| cron/data-retention/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/integrations/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/ios-crashes/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/loyalty/route.ts | GET | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/month-carry/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/notifications/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/prices/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/sms-canary/route.ts | GET | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| cron/sms-harvest/route.ts | GET,POST | cron | Authorization,Bearer,CRON_SECRET,isAuthorizedCron,cronAuth |
| devices/[id]/route.ts | PATCH,DELETE | main-app | — |
| devices/route.ts | GET,POST,PATCH | main-app | resolveRouteUser |
| entitlements/me/route.ts | GET | main-app | — |
| entitlements/seen-resets/route.ts | POST | main-app | — |
| entitlements/trial/route.ts | POST | main-app | — |
| feedback/route.ts | POST | main-app | Authorization |
| flags/route.ts | GET | public-site | — |
| gold/route.ts | GET | public-site | — |
| health/deep/route.ts | GET | public-site | isAuthorizedCron,cronAuth,CRON_SECRET,Authorization,Bearer |
| health/route.ts | GET | public-site | — |
| notifications/route.ts | GET,PATCH | main-app | — |
| prices/refresh/route.ts | POST | main-app | guard |
| push/register/route.ts | POST,DELETE | main-app | bearer |
| push/send/route.ts | POST | main-app | — |
| rates/route.ts | GET | public-site | — |
| receipt/scan/route.ts | POST | main-app | Guards |
| referrals/redeem/route.ts | POST | main-app | — |
| savings/carry/route.ts | GET,POST | main-app | — |
| site/event/route.ts | POST | public-site | — |
| site/lead/route.ts | POST | public-site | — |
| sms/ack/route.ts | POST | main-app | bearer |
| sms/confirm/route.ts | POST | main-app | Bearer,Guards,authorization |
| sms/dismiss/route.ts | POST | main-app | Bearer,authorization |
| sms/flag-action/route.ts | POST | main-app | — |
| sms/health/route.ts | GET | main-app | — |
| sms/own-transfer/route.ts | POST | main-app | — |
| sms/parse/route.ts | POST | main-app | bearer,guardWordsIn,GuardWords,GuardDiverts,GUARD_ENFORCED,Guard,Guards |
| sms/revoke-token/route.ts | POST | main-app | Bearer |
| sms/setup-token/route.ts | GET,POST,DELETE | main-app | Bearer,authorization |
| sms/undo/route.ts | POST | main-app | Bearer,authorization |
| support/attachments/route.ts | POST | main-app | — |
| support/board/[number]/vote/route.ts | POST | main-app | — |
| support/board/route.ts | GET | main-app | — |
| support/submit/route.ts | POST | main-app | — |
| support/tickets/[number]/csat/route.ts | POST | main-app | — |
| support/tickets/[number]/route.ts | GET,POST | main-app | — |
| support/tickets/route.ts | GET | main-app | — |
| voice/transcribe/route.ts | POST | main-app | — |
| webhooks/linear/route.ts | POST | webhook | Signature,signature |
| webhooks/resend/route.ts | POST | webhook | svix,signature |
| webhooks/sentry/route.ts | POST | webhook | Signature,signature |

## 2. Crons

### vercel.json (repo root, regions `fra1`)

| Path | Schedule (UTC) | vercel.json line |
|---|---|---|
| /api/cron/prices | 0 3 * * * | :7 |
| /api/cron/sms-harvest | 10 4 * * * | :11 |
| /api/cron/sms-canary | 50 6 * * * | :15 |
| /api/cron/ios-crashes | 20 7 * * * | :19 |
| /api/cron/data-retention | 40 4 * * * | :23 |
| /api/cron/month-carry | 0 5 * * * | :27 |
| /api/cron/loyalty | 20 5 * * * | :31 |

Cron route files in src (9): data-retention, integrations, ios-crashes, loyalty, month-carry, notifications, prices, sms-canary, sms-harvest. Not in vercel.json: **integrations** and **notifications** (both POST/GET handlers exist). All cron routes check `CRON_SECRET` via `isAuthorizedCron`/`cronAuth` (see section 1).

`docs/SCHEDULED_JOBS.md` lists a `/api/cron/integrations` at 05:30 and says Vercel crons run in region `sin1`; vercel.json says `fra1` (line 2-4). Doc and config disagree.

### pg_cron (`cron.schedule` in supabase/migrations; later migrations may alter)

| Job | Schedule | Migration |
|---|---|---|
| sms-stats-drain | */5 * * * * | 0140_sms_v2.sql:160 |
| sms-heal-stuck | */5 * * * * | 0140_sms_v2.sql:161 |
| sms-zero-variance | 17 * * * * | 0140_sms_v2.sql:162 |
| sms-retention | 50 0 * * * | 0140_sms_v2.sql:163 |
| housekeeping | 30 1 * * * | 0141_retention.sql:107 |
| analytics-rollup | 20 0 * * * | 0139_analytics_v2_admin_cache.sql:216 |
| admin-metrics | */15 * * * * (then 7 * * * * via alter_job in 0215:31; unscheduled in 0300:56) | 0139:217 |
| cron-log-trim | 40 0 * * * (command altered in 0231:31) | 0139:218 |
| user-milestones | 10 1 * * * | 0175_milestones_funnel.sql:118 |
| push-token-sweep | 45 1 * * * | 0213_b6_push_token_lifecycle.sql:47 |
| crash_retention | 40 1 * * * | 0184_client_crashes.sql:49 |
| site-leads-retention | 55 1 * * * | 0238_site_leads_retention.sql:11 |
| db-retention | 10 2 * * * | 0301_db_load_phase_b.sql:210 |
| cleanup-anon-users | 15 3 * * 0 | 0207_b3_cleanup_cron_schedule.sql:116 |
| cleanup-trusted-devices | 20 3 * * * | 0207:117 |
| api-rate-cleanup | */10 * * * * | 0215_b8_db_performance.sql:54 |
| sms-pending-discards | * * * * * | 0273_sms_discard_message.sql:419 |
| sms-tick | */15 * * * * | 0300_db_load_phase_a.sql:160 |
| notifications-hourly | 0 * * * * | 0300_db_load_phase_a.sql:218 |
| ai-chat-error-check | 5 6 * * * | 0342_ai_chat_error_alert.sql:82 |

Other scheduler reference: `docs/SCHEDULED_JOBS.md` (pg_cron and Vercel tables; doc does not list sms-pending-discards or admin-metrics). Migration 0300:16-18 and 0211:273 are rollback/commented-out only; `sms-legacy-harvest` is commented out.

## 3. Supabase call sites

Counts: `.from(` / `.rpc(` lines in non-test `src/**` files, excluding `Array.from`, `Buffer.from` and similar: **779 lines**.

| Folder | Lines |
|---|---|
| src/app/api | 438 |
| src/lib/sms | 157 |
| src/lib/server | 132 |
| src/lib/supabase | 15 |
| src/lib/prices | 4 |
| src/lib/entitlements | 4 |
| src/lib/accounts | 4 |
| src/components/features | 4 |
| src/hooks (useSmsTracking, useAssetPrices) | 5 |
| src/components/sync | 3 |
| src/lib/referrals, loyalty, budget (each) | 2, 1, 1 |

### (a) `select('*')` or `.select()` with no columns

37 lines. Full list (file:line):

app/api/admin/flags/route.ts:11, app/api/admin/flags/route.ts:27, app/api/admin/flags/route.ts:48, app/api/admin/plans/route.ts:14, app/api/admin/plans/route.ts:73, app/api/admin/plans/route.ts:89, app/api/admin/sms/templates/route.ts:46, app/api/admin/sms/templates/route.ts:61, app/api/admin/sms/promotion/route.ts:47, app/api/admin/sms/promotion/route.ts:53, app/api/admin/sms/promotion/route.ts:61, app/api/admin/loyalty/route.ts:11, app/api/admin/support/tickets/[id]/route.ts:31, app/api/admin/crashes/route.ts:18, app/api/admin/users/[id]/financial/route.ts:108, app/api/admin/users/[id]/route.ts:118, app/api/admin/users/[id]/export/route.ts:45, app/api/cron/notifications/route.ts:128, app/api/cron/notifications/route.ts:129, app/api/cron/notifications/route.ts:136, app/api/devices/route.ts:35, components/ui/AmountTextInput.tsx:59, components/features/savings-v3/EmergencyFundSheet.tsx:152, lib/server/carryCycle.ts:73, lib/server/carryCycle.ts:74, lib/server/carryCycle.ts:75, lib/server/carryCycle.ts:76, lib/server/carryCycle.ts:77, lib/server/userData.ts:180, lib/server/devices/registry.ts:82, lib/server/devices/registry.ts:107, lib/server/devices/registry.ts:142, lib/supabase/remote/sync.ts:524, lib/supabase/remote/sync.ts:547, lib/supabase/remote/sync.ts:548, lib/supabase/remote/sync.ts:598, lib/supabase/remote/sync.ts:599

### (b) `.from(...).select(` with no `.limit(`, `.range(`, `.single(`, `.maybeSingle(` within ~6 lines: possibly unbounded

Heuristic (6-line window, so chains that are bounded further down may still show; 141 hits). Grouped by file (count, lines):

| File | n | Lines |
|---|---|---|
| app/api/admin/staff/route.ts | 10 | 19, 20, 21, 22, 102, 105, 117, 122, 124, 135 |
| lib/server/carryCycle.ts | 9 | 73, 74, 75, 76, 77, 78, 129, 131, 133 |
| app/api/sms/parse/route.ts | 8 | 255, 287, 366, 369, 498, 536, 801, 1596 |
| lib/sms/createSmsExpense.ts | 8 | 382, 430, 720, 852, 872, 897, 918, 982 |
| lib/sms/refundMatch.ts | 7 | 175, 202, 228, 281, 296, 314, 324 |
| app/api/sms/flag-action/route.ts | 6 | 79, 109, 136, 186, 236, 255 |
| lib/sms/pairing.ts | 5 | 43, 95, 259, 377, 852 |
| app/api/admin/users/[id]/route.ts | 4 | 216, 221, 226, 231 |
| lib/server/devices/registry.ts | 4 | 45, 82, 155, 161 |
| lib/sms/matchSalary.ts | 4 | 136, 234, 241, 263 |
| lib/sms/ownAccountAnswer.ts | 3 | 47, 49, 76 |
| app/api/admin/access/route.ts | 2 | 26, 27 |
| app/api/admin/emails/route.ts | 2 | 46, 47 |
| app/api/admin/emails/setup/route.ts | 2 | 11, 12 |
| app/api/admin/flags/route.ts | 2 | 11, 12 |
| app/api/admin/loyalty/route.ts | 2 | 15, 81 |
| app/api/admin/plans/route.ts | 2 | 27, 108 |
| app/api/admin/platform/route.ts | 2 | 45, 46 |
| app/api/admin/support/tickets/[id]/route.ts | 2 | 32, 142 |
| app/api/admin/support/tickets/route.ts | 2 | 38, 40 |
| app/api/biometric/register/route.ts | 2 | 44, 53 |
| app/api/sms/own-transfer/route.ts | 2 | 113, 130 |
| hooks/useAssetPrices.ts | 2 | 59, 84 |
| lib/accounts/unplacedForTail.ts | 2 | 38, 66 |
| lib/prices/claimPriceRefresh.ts | 2 | 13, 21 |
| lib/server/email/catalog.ts | 2 | 40, 93 |
| lib/sms/merchantCategoryCache.ts | 2 | 104, 122 |
| app/api/admin/ai/cost/route.ts | 1 | 10 |
| app/api/admin/auth/sessions/route.ts | 1 | 13 |
| app/api/admin/rewards/switches/route.ts | 1 | 10 |
| app/api/admin/sms/health/route.ts | 1 | 11 |
| app/api/admin/sms/logs/route.ts | 1 | 51 |
| app/api/admin/sms/promotion/route.ts | 1 | 77 |
| app/api/admin/sms/queue-health/route.ts | 1 | 26 |
| app/api/admin/sms/templates/route.ts | 1 | 24 |
| app/api/admin/users/[id]/financial/route.ts | 1 | 54 |
| app/api/admin/users/[id]/rewards/route.ts | 1 | 25 |
| app/api/app-config/route.ts | 1 | 12 |
| app/api/auth/password/change/route.ts | 1 | 45 |
| app/api/billing/revenuecat/route.ts | 1 | 48 |
| app/api/cron/data-retention/route.ts | 1 | 24 |
| app/api/cron/sms-canary/route.ts | 1 | 26 |
| app/api/entitlements/me/route.ts | 1 | 91 |
| app/api/notifications/route.ts | 1 | 33 |
| app/api/sms/dismiss/route.ts | 1 | 37 |
| app/api/support/board/route.ts | 1 | 21 |
| app/api/support/submit/route.ts | 1 | 91 |
| app/api/support/tickets/[number]/csat/route.ts | 1 | 27 |
| hooks/useSubscriptionDetector.ts | 1 | 46 |
| lib/prices/fetchKeyed.ts | 1 | 76 |
| lib/server/admin/credentials.ts | 1 | 33 |
| lib/server/admin/metrics.ts | 1 | 27 |
| lib/server/allocateGoalFunding.ts | 1 | 68 |
| lib/server/carryAdjust.ts | 1 | 20 |
| lib/server/pocketLedger.ts | 1 | 18 |
| lib/server/sendNativePush.ts | 1 | 41 |
| lib/server/userData.ts | 1 | 150 |
| lib/sms/accountPlacement.ts | 1 | 83 |
| lib/sms/balanceReport.ts | 1 | 104 |
| lib/sms/captureGuard.ts | 1 | 86 |
| lib/sms/curatedDbCache.ts | 1 | 30 |
| lib/sms/dispatch.ts | 1 | 885 |
| lib/sms/matchSubscription.ts | 1 | 69 |
| lib/sms/negativeCache.ts | 1 | 45 |
| lib/sms/ownAccounts.ts | 1 | 56 |
| lib/sms/providerCascade.ts | 1 | 151 |
| lib/sms/stampFlags.ts | 1 | 11 |
| lib/sms/walletBrand.ts | 1 | 32 |

### (c) `.range(` / `offset`

- `.range(` used only in `src/app/api/cron/notifications/route.ts:127-138` (inside `allRowsIn` batch helper, 10 call sites; batches of ids with `.range(a,b)`).
- `offset` appears as an RPC parameter only: `src/app/api/admin/users/route.ts:30` (`p_offset`, capped by `MAX_OFFSET`). No keyset pagination found in app queries by this grep.

### (d) `.from(` / `.rpc(` inside a loop (6-line lookback for `for`, `forEach`, `map`, `Promise.all`, `while`; heuristic, includes false positives)

150 lines. Grouped:

| File | n | Lines |
|---|---|---|
| app/api/cron/notifications/route.ts | 12 | 95, 126, 127, 128, 129, 130, 131, 136, 137, 138, 296, 297 |
| app/api/admin/users/[id]/route.ts | 7 | 30, 31, 32, 33, 34, 35, 186 |
| app/api/admin/loyalty/route.ts | 6 | 11, 12, 13, 14, 15, 16 |
| app/api/admin/staff/route.ts | 6 | 19, 20, 21, 22, 122, 124 |
| lib/server/carryCycle.ts | 6 | 72, 73, 74, 75, 76, 77 |
| lib/supabase/remote/sync.ts | 6 | 220, 515, 547, 548, 598, 599 |
| app/api/admin/users/[id]/activity/route.ts | 5 | 34, 35, 36, 37, 38 |
| app/api/admin/users/[id]/rewards/route.ts | 5 | 21, 22, 23, 24, 25 |
| app/api/devices/[id]/route.ts | 5 | 74, 75, 76, 78, 79 |
| app/api/admin/emails/route.ts | 4 | 29, 30, 46, 47 |
| app/api/admin/plans/route.ts | 4 | 14, 15, 16, 27 |
| lib/sms/pairing.ts | 4 | 654, 683, 699, 700 |
| app/api/admin/access/route.ts | 3 | 13, 26, 27 |
| app/api/admin/ai/cost/route.ts | 3 | 8, 9, 10 |
| app/api/admin/emails/setup/route.ts | 3 | 10, 11, 12 |
| app/api/admin/sms/queue-health/route.ts | 3 | 13, 18, 26 |
| app/api/admin/support/tickets/[id]/route.ts | 3 | 31, 32, 108 |
| app/api/admin/support/tickets/route.ts | 3 | 38, 39, 40 |
| app/api/admin/users/[id]/sms/route.ts | 3 | 22, 25, 26 |
| app/api/auth/password/change/route.ts | 3 | 50, 51, 52 |
| app/api/health/deep/route.ts | 3 | 22, 23, 24 |
| app/api/sms/parse/route.ts | 3 | 846, 847, 1657 |
| lib/server/userData.ts | 3 | 97, 180, 220 |
| lib/sms/runAdjudication.ts | 3 | 91, 214, 276 |
| app/api/admin/flags/route.ts | 2 | 11, 12 |
| app/api/admin/platform/route.ts | 2 | 45, 46 |
| app/api/admin/sms/templates/route.ts | 2 | 136, 137 |
| app/api/admin/users/[id]/financial/route.ts | 2 | 40, 54 |
| app/api/cron/ios-crashes/route.ts | 2 | 34, 35 |
| app/api/flags/route.ts | 2 | 21, 22 |
| lib/entitlements/server.ts | 2 | 9, 10 |
| lib/server/integrations/outbox.ts | 2 | 16, 18 |
| lib/server/supportRecipient.ts | 2 | 7, 8 |
| lib/sms/ingestGuards.ts | 2 | 173, 174 |
| lib/sms/ownAccountAnswer.ts | 2 | 47, 49 |
| lib/sms/providerCascade.ts | 2 | 145, 148 |
| lib/sms/remaskStores.ts | 2 | 47, 59 |
| lib/sms/stampFlags.ts | 2 | 11, 16 |
| app/api/admin/auth/sessions/route.ts | 1 | 13 |
| app/api/admin/emails/log/route.ts | 1 | 38 |
| app/api/admin/overview/route.ts | 1 | 12 |
| app/api/admin/sms/logs/route.ts | 1 | 51 |
| app/api/admin/sms/promotion/route.ts | 1 | 77 |
| app/api/cron/month-carry/route.ts | 1 | 228 |
| app/api/notifications/route.ts | 1 | 27 |
| app/api/rates/route.ts | 1 | 106 |
| app/api/sms/flag-action/route.ts | 1 | 251 |
| lib/server/admin/credentials.ts | 1 | 33 |
| lib/server/sendNativePush.ts | 1 | 63 |
| lib/server/supportAttachments.ts | 1 | 18 |
| lib/sms/createSmsExpense.ts | 1 | 382 |
| lib/sms/harvest.ts | 1 | 95 |
| lib/sms/negativeCache.ts | 1 | 45 |
| lib/sms/promotionChecker.ts | 1 | 68 |

Example snippets (first hit per top file):

- `app/api/admin/access/route.ts:13`: `.from('admin_access_grants')`
- `app/api/admin/ai/cost/route.ts:8`: `g.ctx.service.rpc('admin_ai_cost_daily', { p_days: days }),`
- `app/api/admin/auth/sessions/route.ts:13`: `.from('admin_sessions')`
- `app/api/admin/emails/log/route.ts:38`: `ctx.service.rpc('admin_email_status_counts', {`
- `app/api/admin/emails/route.ts:29`: `service.from('email_templates').select('locale, ${TEMPLATE_COLUMNS}').eq('key', key),`
- `app/api/admin/emails/setup/route.ts:10`: `g.ctx.service.from('email_log').select('created_at, template_key, status').eq('source', 'auth_hook').order('created_at', { ascending: false `

RPC calls: ~106 `.rpc(` call sites (names via `rpc.txt`); `allRowsIn` batch helper used 10 times in cron/notifications.

## 4. Admin portal

Pages: `src/app/(app)/admin/page.tsx` (renders `AdminApp`), `src/app/(app)/admin/accept/page.tsx`.

52 `.tsx` files under `src/components/features/admin/` (AdminApp, AdminShell, auth/*, emails/*, ui/*, views/* incl. views/sms/*). Client fetch layer: `src/components/features/admin/adminClient.ts` (GET via `fetchOnce`, in-memory `responseCache`, MAX_CACHED 60, STALE_MS 15000, cleared on lock event).

| View | Admin API routes it calls |
|---|---|
| AiCostView | /api/admin/ai/cost  |
| AnalyticsView | /api/admin/analytics /api/admin/analytics/onboarding  |
| AuditView | /api/admin/audit  |
| CrashesView | /api/admin/crashes  |
| EmailsView | /api/admin/emails  |
| FinancialTab | /api/admin/users  |
| FlagsView | /api/admin/flags  |
| LeadsView | /api/admin/leads  |
| LoyaltyView | /api/admin/loyalty  |
| OverviewView | /api/admin/overview  |
| PlansView | /api/admin/plans  |
| PlatformView | /api/admin/platform  |
| RewardsSwitchesPanel | /api/admin/rewards/switches  |
| RewardsTab | /api/admin/loyalty /api/admin/users  |
| SecurityView | /api/admin/auth/biometric/device /api/admin/auth/password /api/admin/auth/sessions  |
| SmsView | /api/admin/sms/health /api/admin/sms/push-health  |
| StaffView | /api/admin/access /api/admin/staff /api/admin/users  |
| SupportView | /api/admin/support/macros /api/admin/support/tickets  |
| UserDetail | /api/admin/loyalty /api/admin/users  |
| UsersView | /api/admin/users  |

All admin routes are wrapped by `guardAdmin` (src/lib/server/admin/guard.ts:95); sign-in routes by `guardSignIn` (:123). Admin RPCs called from admin routes and `src/lib/server/admin/*`: `admin_overview`, `admin_user_directory`, `admin_user_overview`, `admin_user_financial_snapshot`, `admin_ai_cost_daily`, `admin_signup_series`, `admin_onboarding_funnel`, `admin_email_status_counts`, `admin_sms_health`, `admin_ticket_counts`, `admin_rate_hit`, `admin_retention`, `admin_funnel`, `admin_loyalty_summary`, `admin_entitlement_counts`, `admin_billing_counts`, `admin_activity_series`, `admin_adjust_loyalty_points`, `admin_refresh_metrics_if_stale`, and others (see rpc list).

## 5. Images and uploads

- `next/image`: 5 files (e.g. `components/features/subscriptions/BrandTile.tsx:3`, `components/site/PhoneShot.tsx:1`, `components/receipt/ReceiptParts.tsx:5`).
- Raw `<img>`: about 20 files (avatars, provider logos with `onError` fallback, support attachment previews, onboarding shots).
- `background-image`: no matches in `src`.
- `next.config.ts:22`: `images: { unoptimized: true }`, inside the static-export branch (`output: 'export'`) used for native builds. `src/proxy.ts:186` excludes `_next/image` and image extensions from the matcher.
- Storage buckets: `support-attachments` (`src/lib/support/attachments.ts:3`; signed upload URL in `src/app/api/support/attachments/route.ts:29`, client in `src/lib/support/uploadAttachment.ts`). `avatars` bucket: remove only, `src/lib/server/userData.ts:232`.
- Client-side image work: `canvas` / `toBlob` / `drawImage` / `toDataURL` in `src/lib/profile/avatarPhoto.ts`, `src/lib/native/cameraScanner.ts`, `src/lib/loyalty/founderCardImage.ts`, `src/lib/insights/shareRecap.ts`. No dedicated resize/compress library in package.json.
- Native local files (Capacitor Filesystem): `src/lib/native/receiptImages.ts`, `src/lib/native/cameraScanner.ts`, `src/lib/utils/exportFile.ts`, `src/lib/store/usePendingAiJobs.ts`.
- Upload routes: `api/support/attachments`, `api/receipt/scan`, `api/voice/transcribe` (audio), avatar picker `components/profile/AvatarPickerModal.tsx`.

## 6. Caching

- `unstable_cache` (Next): `src/lib/server/platformCache.ts:13` (`cachedSetting`, default 300 s, tag `platform-settings`); `src/app/api/health/deep/route.ts:40` (60 s).
- `export const dynamic = 'force-dynamic'`: `app/(app)/install/layout.tsx:4`, `app/(app)/reset-password/confirm/layout.tsx:3`, `api/health/route.ts:4`, `api/health/deep`, `api/ai/route.ts:24`, `api/budget/ai/route.ts:32`, `api/buddgy/turn/route.ts:20`, `api/buddgy/usage/route.ts:7`.
- `dynamicParams = false` on site pages `(site-en)/en/[[...slug]]` and `(site-ar)/ar/[[...slug]]`.
- `Cache-Control` set in route handlers: `api/rates/route.ts:82,238` (`s-maxage=7200, stale-while-revalidate=14400`); `api/gold/route.ts:151,173` (60/120 and 900/1800); `api/app-config/route.ts:21` (60/300). Most user-scoped routes use `private, no-store`. `src/proxy.ts:141` sets `no-store` on session responses.
- `next.config.ts` `headers()` (lines 28-60): `Content-Type: application/json` for apple-app-site-association; `no-cache, no-store, must-revalidate` for `/sw.js`; global security headers on `/(.*)` (nosniff, X-Frame-Options DENY, HSTS, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control). `vercel.json` has no `headers` key.
- In-memory Maps with TTL/cap: `src/components/features/admin/adminClient.ts:78-79` (response cache 15 s stale, 60 entries, plus in-flight dedupe); `src/lib/server/publicApiRateLimit.ts:14` (`hits` Map, 10,000 IP cap, 60 s window).
- Not present: `revalidate` exports, `fetchCache`, `staleTime`, `useSWR`, `react-query`, `@tanstack/*`, `cache()` from React for data.

## 7. Rate limiting

| Helper | Store | File |
|---|---|---|
| `isRateLimited` / `rateLimitOutcome` (window, max, failOpen flag) | Postgres RPC `api_rate_hit` (shared) | `src/lib/server/rateLimit.ts:6,16` |
| `admin_rate_hit` RPC wrapper | Postgres RPC | `src/lib/server/admin/credentials.ts:51` |
| `publicApiRateLimitOk` (gold, rates only, via `src/proxy.ts:80`) | per-isolate Map first; `api_rate_hit` after half of 240/60 s | `src/lib/server/publicApiRateLimit.ts` |
| Direct `api_rate_hit` RPC calls | Postgres | `api/analytics/onboarding:32`, `api/budget/ai`, `api/admin/users/[id]/financial:154`, `api/admin/users/[id]/export:30`, `api/admin/sms/logs:98` |

Routes/libs using `isRateLimited` or `rateLimitOutcome`: app/api/savings/carry/route.ts, app/api/sms/parse/route.ts, app/api/sms/setup-token/route.ts, app/api/auth/check-email/route.ts, app/api/referrals/redeem/route.ts, app/api/feedback/route.ts, app/api/push/send/route.ts, app/api/biometric/signin/route.ts, app/api/support/tickets/[number]/route.ts, app/api/support/submit/route.ts, app/api/support/board/[number]/vote/route.ts, app/api/support/attachments/route.ts, app/api/ai/route.ts, app/api/site/lead/route.ts, app/api/site/event/route.ts, app/api/account/delete/route.ts, app/api/billing/paywall-view/route.ts, app/api/billing/sync/route.ts, lib/server/reauth.ts, lib/server/rateLimit.ts.

No Upstash, Redis, or `Retry-After` helper found. `api_rate_hit` counters are pruned by pg_cron `api-rate-cleanup` (migration 0215).

## 8. Data fetching and state

| Package | Version (package.json) |
|---|---|
| @supabase/supabase-js | ^2.119.0 |
| @supabase/ssr | ^0.12.7 |
| zustand | ^5.0.12 |
| zod | ^4.3.6 |
| next | 16.4.5 |
| react / react-dom | 19.2.4 |
| @sentry/react | 10.69.0 |
| @sentry/capacitor | 4.4.0 |
| @revenuecat/purchases-capacitor | 14.1.0 |

No SWR, TanStack Query, or Redux/Jotai in dependencies. State: zustand stores in `src/lib/store/` (e.g. `useSettingsStore.ts`, `usePendingAiJobs.ts`); data fetch is plain `fetch` plus supabase-js.

## 9. Supabase client creation

| Client | Where | Notes |
|---|---|---|
| Browser (web) | `src/lib/supabase/client.ts` `createClient()` via `createBrowserClient` (@supabase/ssr) | cookie options from `cookieDomain.ts`; `global.fetch = secondFactorAwareFetch` |
| Browser (native) | same file, `createSupabaseClient` (supabase-js) singleton `_nativeClient` | `flowType: pkce`, `persistSession`, `autoRefreshToken`, `lock: processLock` (one WebView, one client) |
| Server (RSC, route handlers) | `src/lib/supabase/server.ts` `createClient()` via `createServerClient` (@supabase/ssr) | cookie-based session |
| Service role | `src/lib/supabase/service.ts:6` `createServiceRoleClient()` (alias `createSecretClient`), `persistSession: false` | new instance per call, no singleton; called from 86 `src` files |
| Env | `src/lib/supabase/env.ts` | reads `NEXT_PUBLIC_SUPABASE_URL`, publishable key (legacy anon accepted), secret key (legacy service-role accepted) |

Pooling / connection config: none in `src` (no `pgbouncer`, `pooler`, `max:`, or `connectionString` matches). `supabase/` migrations and pg_cron live server side. `src/proxy.ts` (Next middleware) also creates a server client.

