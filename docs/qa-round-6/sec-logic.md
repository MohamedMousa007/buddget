# QA Round 6: sec-logic (prefix SLG), business-logic and architecture security

Covered: money, identity and sync trust boundaries: month-carry cron, pocket ledger RPCs, sync merge/delta/push and the 0232 stale-write guard (with a seeded 3-device property test), SMS ingest/pairing/template promotion/retention, Buddgy tool approval flow, AI quota SQL, admin RBAC/DSR export/audit, account deletion, privacy-policy claims, RLS grants, entry-point inventory. NOT covered in depth: `sms/parse` body beyond dedupe/sender/push paths, ENV.md, IOS_SMS_TRACKING.md, MONEY_MOVEMENT.md line-by-line (only spot-read), App Store/Play docs beyond STORE_PRIVACY (iOS privacy manifest vs table compared), the terms text (only the SMS-token clause read), live HTTP probing. The workflow-style skills (Workflow tool absent) were run manually.

## Findings

| ID | P | file:line | finding | evidence | suggested fix | status |
|---|---|---|---|---|---|---|
| SLG-1 | P2 | `api/cron/month-carry/route.ts:157-163`, `lib/savings/monthCarry.ts:83-87` | A manual goal with no eligible pocket wins `resolveCarryDestination` as `create-goal-pocket` ("make one named after the goal and link it"). The route creates the pocket but never writes `goals.linked_savings_account_ids` (only `create-vault` stores a default). Next cycle the same branch fires again: one new duplicate pocket per month, carry scattered, none attached to the goal. Live money cron (scheduled daily 05:00 UTC). | `repro/sec-logic/carryDest.test.ts.txt`: after the route's side effect (pocket exists, goal unlinked) the resolver still answers `create-goal-pocket`, expected `pocket`. Fails in Cairo, New York, Riyadh. | after the insert, update the goal's `linked_savings_account_ids` with the new id; look up an existing unlinked pocket by goal name first so a crash between insert and deposit cannot duplicate | Confirmed |
| SLG-2 | P2 | `supabase/migrations/0232_stale_write_guard.sql`, `private.reject_stale_write`, `lib/supabase/remote/sync.ts:withEditTime`; contradicts `docs/OFFLINE_GUIDE.md:37` | The guard compares the pushing device's EDIT time with the stored `updated_at`, which `set_updated_at` (`NEW.updated_at = now()`, read live) sets to ARRIVAL time of the previous write. Two devices edit one row offline: A at +10 min, B at +20 min (newest). A reconnects first (+100), B later (+200): B's edit is "older" than A's arrival, is skipped silently (`skippedWrites`), B re-pulls and loses its newest edit. The guide promises "newest edit wins, by edit time and not by who syncs last"; reality is first-to-reconnect wins for concurrent offline edits. | `repro/sec-logic/syncConverge.test.ts.txt`: deterministic case server ends with A's value (expected B's); seeded property (400 seeds x 60 ops, model of 0232 + real `diffLists`/`applyDelta`): newest-edit survives failed in 67 of 400 seeds. Live SQL confirmed trigger and `set_updated_at` bodies. | store edit time in a separate column (`edited_at`) set only from the client stamp and compare against that; or have the guard compare against the previous write's client-supplied stamp | Confirmed |
| SLG-3 | P2 | `supabase` fn `check_sms_promotion_eligibility()` (live), `lib/sms/promotionChecker.ts:42-98`, migration 0097 | The Template -> Curated DB auto-promotion can never fire: the function filters `t.tier = 'learned'`, but 0097 renamed every `learned` row to `curated_db`/`template`. Live: 0 `auto_promoted`, 46 active `template` rows (max `unique_user_count` < 3), 10 `curated_db`. So the self-correcting funnel never widens reach; each new user pays AI cost again. SECURITY NOTE for the fix: live `sms_promotion_config` is min_unique_users=3, min_match_count=1, min_age_days=0, and "unique users" are account ids (free signups), so repairing the filter as is lets three throwaway accounts promote an attacker-shaped regex globally (only the replay-regression gate stands in the way). | SQL: function body contains `'learned'`; tier counts above; `auto_promoted` count 0 | change the filter to `tier = 'template' and status = 'active'` AND raise min_age_days/min_unique_users and count distinct devices or verified accounts before enabling | Confirmed |
| SLG-4 | P2 | `api/sms/parse/route.ts:953-956,1019-1132`, `lib/sms/ingestGuards.ts:checkCreditSender`, `lib/native/pushActionQueue.ts`, `components/layout/AppShell.tsx:SmsPushActionHandler` | The spoofed-sender protection is cosmetic. A credit whose alphanumeric sender is not a known bank id is "held for confirmation", but the push for it is the generic `sms_confirm` kind ("Couldn't add automatically, tap to add"), with no mention of the unverified sender, and the tap handler ignores `actionId` and POSTs `/api/sms/confirm` straight away, booking the income with no review sheet. One tap on the notification body books an attacker-forged "salary credited" SMS. Effect: wrong income number (no funds move), but exactly what the hold exists to prevent. | static trace parse route -> `sms_confirm` push -> handler -> confirm route claim (`awaiting_confirmation:false`) -> income posted | give sender-mismatch holds their own push kind that opens the review sheet with the sender shown; never confirm from a body tap | Static |
| SLG-5 | P3 | `lib/server/admin/audit.ts:15-26`, `api/admin/users/[id]/export/route.ts` | Audit is fail-open ("failures are reported, not thrown"): the DSR export of a user's full financial data (and every other audited admin read) is returned even when the `admin_audit_log` insert fails. A malicious or compromised staff member who can make the insert fail loses nothing; the trail has a silent hole. Controls around it are strong (dsr.manage, financial grant, reason, step-up, 5/h). | static | for `dsr.export` and `pii.*` reads, write the audit row first and refuse on error | Static |
| SLG-6 | P3 | privacy policy section 4 (`legal/privacy/sections/PrivacyDataSections.tsx`) | Policy says "Data stored on Supabase servers in the United States". The project region is `ap-southeast-1` (Singapore) and Vercel runs `sin1`. | `get_project` region; `vercel.json` regions | fix the policy (Singapore) and the international-transfer paragraph | Confirmed |
| SLG-7 | P3 | `sms_retention()` (live), policy sections 2 and 6 | Policy: "raw message kept at most 30 days; corpus kept 180 days". Code: (a) parsed rows still waiting for confirmation (`awaiting_confirmation`) are exempt from the 30-day purge and live to the 60-day cap (live: 1 row at 53 days); (b) `sms_corpus` rows with `seen_count >= 3` are never deleted (only `< 3` after 180 days). Separately, until the 2026-11-06 00:50 UTC run, 172 learned+masked rows past 30 days still hold raw text (0229 applied after today's run); verify tomorrow that the query returns 0. | SQL counts above | add the awaiting rows to the 30-day purge or reword the policy; delete corpus rows by age regardless of count | Static |
| SLG-8 | P3 | `ai_quota_reserve` (live SQL) | Receipt (monthly) and voice (daily) caps count only settled `status='ok'` events; unlike chat they ignore in-flight reservations. A burst of up to `ai_req_per_min` (30) concurrent scans passes a cap of N. Latent: defaults for `receipt_scans_per_month`, `voice_entries_per_day`, `ai_chat_per_day` are null (unlimited) today; unit windows (which do count reservations) still bound cost. | SQL function body | union unsettled reservations into the receipt and voice counts as chat does | Static |
| SLG-9 | P3 | `api/sms/parse/route.ts`, `proxy.ts` | No per-user request or row cap on the non-AI parse path: a token holder (or any session) can post unlimited distinct `eventId`s, each creating a `sms_parse_log` row (up to 2,000 raw chars), ledger rows and pushes. Same for direct PostgREST writes (no row quotas). The ingest token is a plaintext, non-expiring `gen_random_uuid()` column with unique index (trusted-device and biometric secrets are hashed), so a DB read leaks working credentials. | grep: no `api_rate_hit` in the parse route; `column_default` of `sms_ingest_tokens.token` | rate-limit by user via `api_rate_hit`; store a SHA-256 of the token | Static |
| SLG-10 | P3 | `api/push/register/route.ts:70-78` | A push token is claimed with no proof of possession: `delete ... where token = X and user_id <> me` removes another account's row, then it is re-registered to the caller, so anyone who learns a device's FCM token can silence that account's pushes and send self-addressed pushes (title/body arbitrary, via `push/send`) to that phone. Needs the 150+ char token (not guessable). The code comment says `UNIQUE(token)`; the live index is `(user_id, token)`. | live `pg_indexes` | acceptable if tokens stay secret; fix the comment, consider verifying the token with an FCM dry-run per account | Static |
| SLG-11 | P3 | `api/cron/month-carry/route.ts:100-104` | A user created after the newest closed cycle started returns `false` with no summary row, so each daily run re-reads seven tables for that user until the next cycle closes (cost only). | static | write an empty summary row for the skipped partial cycle | Static |
| SLG-12 | P3 | docs | `NOTIFICATION_LISTENER.md` describes an Android `NotificationListenerService` plugin and a web `notificationParser.ts` that do not exist in the repo (no service in the manifest, nothing under `src/lib/native`), yet the policy lists "SMS or notifications" and "notification ingest endpoints". `ADMIN_PORTAL.md` says `users.financial` is held by "the admin role and the owner"; live `admin_roles.admin` does not hold it (owner only, via `*`), and the doc's role list omits `compliance`, `data_ai`, `product`. | grep, live `admin_roles` | update docs and policy wording | Confirmed |

fp-check/brocard calibration: SLG-1, SLG-2, SLG-3, SLG-6 have a runnable repro or a live query. SLG-4 is an attacker-in-the-loop UX weakness (needs SMS sender spoofing and one tap) so P2, not P1. SLG-10 dropped to P3 because the precondition is a secret. Candidates I tested and dismissed are in the clean table (balance drift, 2FA trigger duplicated by AUT-1/DBS-7, SECURITY DEFINER RPCs).

## Spec-vs-code divergence (including policy claims)

| Spec claim | Verdict | Where |
|---|---|---|
| OFFLINE_GUIDE:37 newest edit wins by edit time | DIVERGES | SLG-2 |
| OFFLINE_GUIDE:93 nothing lost (queue removed after confirm) | holds for pushes; but skipped stale writes are dropped silently | SLG-2 |
| ADMIN_PORTAL: `users.financial` = admin + owner; role list | DIVERGES (owner only; 3 extra roles) | SLG-12 |
| ADMIN_PORTAL: owner row immutable, `users.delete` owner only, grants audited, DSR needs grant+step-up | holds (trigger `admin_staff_guard_owner` enabled; admin lacks users.delete; export route reads) | clean table |
| NOTIFICATION_LISTENER.md plugin and web parser | DIVERGES (not in repo) | SLG-12 |
| CSP.md nonce + strict-dynamic, no unsafe-inline/eval in script-src, object-src none | holds (`lib/security/csp.ts`) | clean table |
| MONEY_MOVEMENT "money inside own methods is never spend/income" | not re-verified here (money finder's area); month-carry excludes non-spend | n/a |
| Policy s.2 SMS raw kept <= 30 d (7 d rejected/OTP), hard cap 60 d, masked copy kept, corpus 180 d | PARTLY (see SLG-7); 7-day rejected purge and 60-day cap verified live | SLG-7 |
| Policy: voice audio discarded, receipt images not stored | holds: voice/receipt routes call no storage API; only Groq/Gemini | verified |
| Policy: no Buddgy transcript kept, only counts + memory notes | holds: `ai_chats` has units/turns only, `ai_usage_events` no text | verified |
| Policy: deletion within 30 days, backups 90 d | holds and better: `deleteUserCompletely` cascades immediately; every `user_id` table has FK CASCADE except `admin_*` ones swept by `ACCOUNT_TABLES`, `support_tickets`/`email_log` scrubbed | verified |
| Policy: push tokens deleted on delete account | holds (CASCADE) | verified |
| Policy: website messages and waitlist deleted after 180 d | holds (pg_cron job 16) | verified |
| Policy: CSV export in Settings; full copy by email | holds (`DataCard` CSV; admin DSR export) | verified |
| Policy: Sentry gets account id + device info only | holds (`sendDefaultPii:false`, scrub hooks, hashed device id) | verified |
| Policy: RLS isolates users; ingest endpoints use per-user tokens you can rotate | holds (RLS on all user tables; DELETE setup-token rotates); token stored plaintext | SLG-9 |
| Policy: data stored in the United States | FALSE (Singapore) | SLG-6 |
| Policy: Gemini paid tier / Groq not retained / Supabase AES-256 | cannot be verified from code | n/a |
| STORE_PRIVACY table vs iOS `PrivacyInfo.xcprivacy` (12 types) and Android permissions | holds: Name, Email, Phone, UserID, DeviceID, OtherFinancialInfo, OtherUserContent, Photos, Audio, ProductInteraction, Crash, Performance; Android has CAMERA, RECORD_AUDIO, RECEIVE_SMS, BIOMETRIC, POST_NOTIFICATIONS only | verified |

## Invariants (written down) and result

| Invariant | Verification | Result |
|---|---|---|
| I1 Pocket balance == opening + net ledger, whoever writes (cron, RPC, client upsert) | live: delta mode on, 13 pockets, 0 drift; 0227 trigger keeps OLD balance for client writes | holds |
| I2 One carry per (user, cycle) | UNIQUE(user_id, month_key), advisory lock per (pocket, group), unique live-group index, `alreadySwept`, goal-run claim rows | holds |
| I3 Carry is never invented: fails closed without FX, carry excludes its own deposits, floored at 0 | read cycleCarryFigures/monthCarry, route 503 | holds |
| I4 Carry deposits only into the owner's own pockets and payment methods | resolver only sees the user's pockets; `adjust_pocket_balance` raises on foreign payment method | holds |
| I5 A deleted row is never resurrected by sync | seeded property, 400 seeds x 60 ops: 0 resurrections | holds |
| I6 Devices converge to the server state after flush+pull | same run: 0 divergent devices | holds |
| I7 Newest edit (by edit time) survives | same run | VIOLATED (SLG-2) |
| I8 Stale offline edit cannot revive a tombstone; only a re-added id revives | read 0232 + `emitList` | holds |
| I9 Quota reserve is serialised per user and bounded by unit windows | live function: advisory lock, reservations in windows | holds (SLG-8 latent) |
| I10 Auto-applied Buddgy writes stay small, recent and never after a read | `autoApplyGuard` (<=10k base, <=5% income, <=7 days, 5/min, `!afterRead`, no duplicates); settings/security changes are `approve` | holds |
| I11 Template reach grows only through verified agreement | promotion dead (SLG-3), so reach never widens: safe by accident | holds, feature broken |
| I12 Admin reads of financial data need grant + reason + step-up + audit | export and activity routes read; owner trigger live | holds (SLG-5 fail-open audit) |
| I13 Account deletion removes all user rows | FK rule query (all CASCADE or swept) + `deleteUserCompletely` | holds |
| I14 Entitlement and limits are server-owned | `user_entitlements` RLS no policy, limits read by SECURITY DEFINER `ai_effective_limits` | holds |

## Verified clean

| Invariant / check | how verified | result |
|---|---|---|
| Savings balance derived from ledger, no drift | live SQL drift query | 0 of 13 |
| SECURITY DEFINER RPCs callable by authenticated bind to `auth.uid()`+ownership | `pg_proc` source of 4 plus 0198 for the v2 trio | hold |
| `adjust_pocket_balance`, `sms_try_pair`, `ai_quota_*`, promotion fn not callable by API roles | advisor lists only 11 authenticated-callable definers, none of these; grants in 0155/0198/0235 | hold |
| RLS write surface: `savings_month_summary`, `goal_allocation_runs` are select-only despite table grants | `pg_policies` | hold |
| `profiles.default_carry_pocket_id` pointing at another tenant's pocket cannot redirect the carry | resolver filters the user's own pockets | hold |
| Replay of an SMS ingest request cannot double-book | `hashForEvent`/bucket hash + unique (user_id, sms_hash) + neighbour buckets; cross-tenant impossible (user from token) | hold |
| Forged template cannot auto-book for others | author-scoped until promotion (promotion dead, SLG-3); learn gates + replay gate | hold |
| SMS pairing cannot cross tenants or double-pair | 0235: advisory lock, `user_id = p_user_id`, claimed leg claims nothing | hold |
| Buddgy approvals: tools run on device, `approve`/`strong` need a tap, auto only after no read | `autoApplyGuard`, `exec/expenses.ts` | hold |
| Admin portal: staff guard, CSRF, permission per op, step-up, rate limits, reasons | export/activity/password routes read | hold |
| Admin password change lockout and ordering | `admin/auth/password/route.ts` | hold |
| Push tap with forged data only affects the caller's own rows | handler posts hash to confirm route which scopes `user_id` | hold |
| Cron routes reject without secret | month-carry guard first line; round-5 matrix | hold |
| CSP matches docs | `lib/security/csp.ts` | hold |
| No service worker data path: `sw.js` precaches static chunks, only a `message` listener | grep | hold |
| Deep link `app.buddget://auth/callback` is inert (no `appUrlOpen` handler; native login is idToken only) | grep | hold |
| Exported Android `SmsReceiver` guarded by `BROADCAST_SMS` | manifest | hold |
| Differential review of last 8 commits (round 5 closing, month-carry schedule/dryRun): removed lines are the `resolveApiUserId -> resolveActiveApiUserId` swap, no validation removed | `git diff f34b9f1c~1..HEAD` grep | no regression |
| 2FA flag writable by the owner session directly | trigger `guard_two_factor_flag` only active when gate mode is not off; already reported as AUT-1/DBS-7 | duplicate, not re-reported |

## Entry-point matrix (state-changing; A=anon/public, S=session JWT, V=verified identity, T=ingest token, C=cron secret, W=signed webhook, R=service role only, Adm=staff guard)

| Entry | Class | Weaker than the data it touches? |
|---|---|---|
| `POST account/delete` | V + sign-in <=5 min | no |
| `POST auth/two-factor, second-factor, device/trust, password/change` | V (+reauth/OTP) | no; 2FA flag also writable via REST (AUT-1) |
| `POST biometric/register` (fresh sign-in, 64-hex), `signin` (secret) | V / secret | no |
| `POST sms/parse, ack, confirm, undo, setup-token` | S or T (+ `smsDeviceGate`, `isAccountActive`) | T is a plaintext non-expiring uuid, no per-user rate limit (SLG-9) |
| `POST push/register, DELETE`, `push/send` (self) | S | token claim without proof (SLG-10) |
| `POST ai, buddgy/turn, budget/ai, receipt/scan, voice/transcribe` | S + quota | quota gaps latent (SLG-8) |
| `devices`, `devices/[id]`, `notifications`, `feedback`, `support/*`, `analytics/onboarding`, `flags`, `entitlements/me` | S | no |
| `cron/*` (7, GET; notifications also POST via pg_cron) incl. `month-carry` (writes money) | C | no |
| `webhooks/linear, resend, sentry`, `auth/email-hook` | W | no |
| `site/event, site/lead, auth/check-email, prices/refresh, gold, rates, app-config, health*` | A (limited) | by design |
| `admin/*` (35 routes) | Adm | audit fail-open (SLG-5) |
| PostgREST tables (30 user tables) | RLS own-rows | `savings_transactions` and profile/settings are client-writable by design |
| RPCs `add_*_with_*`, `cancel/reactivate_subscription`, `deposit/withdraw/correct_savings_*_v2`, `analytics_touch` | S (definer, `auth.uid()`) | no |
| RPCs `adjust_pocket_balance`, `sms_try_pair`, `ai_quota_*`, `check_sms_promotion_eligibility` | R | no |
| Native: SmsCapacitorPlugin/`SmsReceiver`, DocumentScanner, biometric-auth, Filesystem receipts, Preferences secrets, social-login, local-notifications | device-local, owner only | n/a |
| Push tap `sms_confirm` -> `/api/sms/confirm` | S via tap | single tap books a held credit (SLG-4) |
| Deep link `app.buddget://auth/callback`, share targets, postMessage/BroadcastChannel/storage events | none handled in `src` (only SW `SKIP_WAITING` message) | n/a |

Repros kept: `docs/qa-round-6/repro/sec-logic/syncConverge.test.ts.txt` (convergence/no-resurrection pass, SLG-2 fails), `carryDest.test.ts.txt` (SLG-1 fails). Property test is a hand-written seeded generator (no dependencies), server model = 0232 trigger + `set_updated_at` + tombstone/revive, client = real `diffLists` and `applyDelta`. Run in Cairo, New York and Riyadh with identical results. `src/__qa6__/sec-logic/` removed.

Coverage: read fully: month-carry route and libs, pocketLedger, allocateGoalFunding, merge/delta/diff/serverClock/stampEdits, sync.ts 1-270, migrations 0198 (head), 0232, 0233, 0235, ingestGuards, templateScope, promotionChecker, autoApplyGuard, add_expense executor, deleteAccount, userData (tables), admin export/activity/password/audit, push/register, SMS push action handler, all four privacy sections, STORE_PRIVACY. Skimmed: learnGates, `sms/parse` (grep), Buddgy tool specs, proxy.ts, NOTIFICATION_LISTENER/ADMIN_PORTAL/CSP/OFFLINE docs (claims grepped). Live SQL: roughly 25 read-only queries (no writes).

Skills used: audit-context-building, entry-point-analyzer, spec-to-code-compliance, differential-review, fp-check, property-based-testing, vulnerability-triage-brocards, security-review, find-bugs (methodology, manual execution).
