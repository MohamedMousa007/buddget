# S4: security and money-path QA

Date 2026-11-15. Scope: section S4 of `docs/MASTER_PLAN_LAUNCH.md`. Delta since QA round 6 (commit `5c3cdb8e`). Fable 5.2 designed and reviewed; Sonnet agents did the first-pass reads and wrote part of the tests. No personal names, message text or account digits appear here.

**Production was not receiving any deployment.** Every Vercel build from at least 2026-11-14 23:01 (commit `0087710d`) to `40059618` failed on one type error in `src/app/api/sms/own-transfer/route.ts`. The lockfile installs `@supabase/supabase-js` 2.119.0, but this checkout's `node_modules` still had 2.99.3, so the local `npm run verify` passed while the real build failed. Fixed in `bb4e70e4` after `npm ci`; that deployment succeeded. Consequence: the S2d, S3 and S4 code all went live together at that moment, and every earlier "pushed" in these notes meant pushed, not deployed. Migrations applied in that window ran against the older deployed code.

**Closing batch (section 9, commits `ec1ad1b2`, `f282ecd8`, `075fa3f1`) changes live behaviour for testers in two ways.**
1. **SMS ingest tokens are now stored as a hash.** Existing phones keep working with no action: the hashes of the tokens already issued were backfilled. Every token fetch now issues a new token (the newest 3 per phone stay valid). See section 9 for the one tester instruction.
2. **Shared merchant categories:** one AI answer can no longer replace a seed category. Reading the code showed other users were already protected from single AI answers (only seed rows and rows five users agreed on are shared), so the two-user rule the council asked for was already exceeded; the gap was the seed overwrite.

**Result: 0 P0, 6 P1 (all fixed in this session, each with a test that failed before the fix), 31 P2 (listed with a proposed fix, not fixed), 8 unconfirmed.** The database check (row security, grants, function privileges) found nothing.

How to read the severity: P0 = another user's data or money exposed or lost now. P1 = wrong money figure, a ledger change without a session, or a cost leak, reachable today. P2 = hardening, low reach, or needs a product decision.

A P2 "repro" below is the exact steps or query, not a committed test; only the P1s have committed tests.

## 1. P1: fixed

| # | Where | Failing scenario | Test (failed before, passes now) | Fix |
|---|---|---|---|---|
| P1-1 | `src/lib/sms/ownAccountAnswer.ts:75` | The user answers "it came from my own account" twice quickly (double tap, or two devices). Both requests retract the income; the second fails the unique insert on `expenses` and its rollback revives the income. Result: the transfer and the income are both live, so the money is counted twice. | `src/app/api/sms/own-transfer/route.test.ts` "answers ok+stale, inserts nothing and revives nothing" | The retraction is a claim (`deleted_at is null`, rows returned). Zero rows means another request won: answer `stale`, insert nothing, roll back nothing. |
| P1-2 | `src/app/api/sms/flag-action/route.ts:108` (`refundMatch`) | Two "match this refund" requests for the same refund against two different purchases. Each stamps its own purchase (guarded), then both retire the placeholder (unguarded). One refund ends up reducing two purchases. | `src/app/api/sms/flag-action/route.test.ts` "answers 409 and clears its own stamp" | The retire is a claim; the loser clears its own stamp and answers 409. |
| P1-3 | `src/app/api/sms/flag-action/route.ts:285`, `src/app/api/sms/own-transfer/route.ts:71`, `src/app/api/sms/undo/route.ts:34` | The SMS ingest token never expires and is stored on the phone. These three routes accepted it, so anyone holding a leaked token could undo bookings, re-point refunds and convert income to transfers for that user, with no session. No app code calls them with that token (the app uses the session; the service worker uses cookies). | "a session-less ingest token is refused with 401 before any database call" in the flag-action and own-transfer tests; "refuses an SMS ingest token" in the undo test | A bearer caller that is not a session (`viaJwt === false`) gets 401 before any read. The token still works on `sms/parse` and `sms/ack`, which is its job. |
| P1-4 | `src/app/api/ai/route.ts` (outer `catch`) | A request that hits the 25 s upstream deadline is settled as 0 tokens, status `error`. The provider still bills it. A user can send large prompts that time out and never use any allowance. | `src/app/api/ai/route.test.ts` "settles an upstream timeout as aborted with the estimated usage" | The catch settles `aborted` with the estimated prompt tokens and the clamped output ceiling. |
| P1-5 | `src/app/api/ai/route.ts` (`grounded`) | `grounded: true` is set by the client and turns on web search, which the provider bills per request on top of tokens. It was not counted anywhere. | same file, three grounding tests | Per-user allowance of 10 grounded requests a day (`ai-grounded:<user>` counter, fails closed). Past it the request still runs, without search. The number is a decision, see section 6. |
| P1-6 | `src/lib/accounts/balance.ts:85` | "It was my own money" on a wallet top-up retracts the income and writes a Transfer with no source and the wallet as destination. The balance loop skipped the whole row because the source was unknown, so the wallet lost the credit: a 100 top-up showed 0 in the wallet. Live rows with this shape today: 0 (checked), so nothing to repair. | `src/lib/accounts/balance.test.ts` "credits the destination account and debits nothing" | Only the debit is skipped when the source is unknown; the destination is still credited. Credit-card payoff rows are unchanged. |

Also done first, as the brief asked: `database.types.ts` regenerated from the live schema (commit `0a5c1b6c`, two crash-record RPC calls needed a cast), and the real-looking name and address in SMS and crash fixtures replaced with stand-ins (commit `e7532c8f`).

## 2. Checked and clean

**Database, live (scope 1).**
- Every public table has row security on.
- About 50 tables have no policy and no grant to `anon` or `authenticated` (admin, AI, entitlements, devices, and `sms_repair_audit`, `sms_s3_input`, `sms_s3_totals_before`, which were read only). Service role only, as intended.
- The only `anon` grant is `SELECT` on `asset_prices`.
- Policies with no user check are deliberate: explicit deny, or public reference data (prices, market data, merchant categories).
- Functions `authenticated` can run: the security-definer ones (`analytics_touch`, the three savings v2 functions, `second_factor_status`) all key on `auth.uid()`; the sync functions run as the caller and quote identifiers. The `sms_s3_*` functions and `sms_discard_message` are service role only.
- `profiles`: `email`, `welcome_email_sent_at`, `data_reset_at` and link columns are pinned by triggers. Realtime is scoped to the caller's own topic.

**Routes.** Cron auth is constant-time and fails closed. Tenant scoping holds in flag-action, own-transfer, undo and the savings carry routes. Bodies are schema-validated.

**AI.** Every endpoint authenticates before the model call. The ingest token reaches AI only through `sms/parse`. Reservation is atomic (advisory lock) and fails closed. `buddgy/turn` fixes the model, prompt and tools on the server. Keys travel in a header, never a URL. No endpoint puts another user's rows in a prompt; the shared-learning paths that carry one user's answers to others are P2-23, U-6 and U-7.

**Income exclusion (carried item).** No SQL function or view sums `income_events`. The only server total is `src/lib/server/carryCycle.ts:76` → `src/lib/savings/cycleCarryFigures.ts:43`, which calls the same `actualIncomeForMonth` the client uses, so excluded events drop out on both sides. The one gap is P2-9.

## 3. P2: listed, not fixed

### Routes and admin
| # | Where | Scenario | Proposed fix |
|---|---|---|---|
| P2-1 | `src/app/api/admin/sms/templates/route.ts:53-67,100-110` | An admin `update` can swap the regex on a curated template without replaying stored messages, and the template cache is not invalidated. Repro: update a curated row's pattern, parse within the cache window. | Run the same replay gate as create; bump the cache key on write. |
| P2-2 | `src/lib/devices/registry.ts:92` | `smsQueue.oldestAt` is stored without checking it is a timestamp, and the update result is not checked. Repro: post a device heartbeat with a non-date string. | Validate as ISO datetime; log a failed update. |
| P2-3 | `src/app/api/sms/parse/route.ts:592,812`, `src/app/api/sms/confirm/route.ts:213` | Whole error objects are logged; a database error can carry row values. | Log `error.message` and code only. |
| P2-4 | `src/app/api/savings/carry/*` | No rate limit, and each call fetches FX rates. Repro: loop the route with a valid session. | `isRateLimited` per user, as on the AI proxy. |
| P2-5 | `src/lib/integrations/sentryWebhook.ts` (`freshHook`) | The freshness check trusts a timestamp header that is not inside the signed payload, so a captured request can be replayed with a new timestamp. | Sign `timestamp.body`; see section 5. |
| P2-6 | admin device list | Device names are shown unmasked to any admin with the logs permission. | Mask to model name unless the admin opens the row. |
| P2-7 | flag-action, own-transfer | 403 for "exists but not yours" vs 404 for "does not exist" tells a caller which ids exist. Ids are random UUIDs, so reach is low. | Answer 404 for both. |

### Money math
| # | Where | Scenario | Proposed fix |
|---|---|---|---|
| P2-8 | `src/lib/savings/cycleCarryFigures.ts:26` vs `src/lib/utils/calculations.ts:511-524` | The server ignores month-carry deposits when it totals a closed month; the client counts them (they are stored as cash flow, dated the last day of the closed month; 3 live rows). The closed month's "left to spend" on the phone is lower than the figure the carry was computed from. Which is right is a product call, section 6. | Either filter `source === 'carry'` on the client too, or document that the closed month shows the sweep as saved. |
| P2-9 | `src/lib/utils/calculations.ts:236-251,279` | An income event that belongs to a template ignores its `exclusion`, on client and server alike. Repro: exclude a templated event; month income does not change. | Apply the exclusion filter before the template branch. |
| P2-10 | legacy cash-outflow path | A purchase on a card excluded from net worth still counts in cash outflow. | Skip excluded-card rows in the outflow sum. |
| P2-11 | legacy cash-outflow path | Pass-through income is dropped but its payout stays in cash outflow, so the month looks worse by the payout. | Drop the paired payout too. |
| P2-12 | `src/lib/accounts/balance.ts` | An ATM withdrawal with no Cash method lowers accounts-basis net worth; cross-currency legs are approximate. | Treat as transfer to an implicit cash account, or prompt to add Cash. |
| P2-13 | `src/lib/utils/currency.ts:127-143`, `src/lib/networth/netWorth.ts:73` | `convertCurrency` falls back to 1:1 when a rate is missing, so a foreign balance is added as if it were base currency. | Use `tryConvertCurrency` and mark the total approximate. |
| P2-14 | two hard-coded fallback rate tables | They disagree, so offline totals differ by screen. | One table. |
| P2-15 | one-time `income_sources` | Bucketed by `createdAt` in the runtime zone: UTC on the server, local on the phone. A source created near midnight lands in different months. | Bucket by the user's zone on both sides. |
| P2-16 | SQL debt sums | `coalesce(amount_in_debt_unit, amount)` adds amounts in different currencies when the first is null. | Convert, or exclude rows with no unit amount. |
| P2-17 | savings deposit with no source account | Raises accounts-basis net worth (money appears in the pocket, leaves nowhere). | Require a source or flag as declared. |
| P2-18 | `totalSpent` | Unfiltered, but nothing reads it. | Delete it. |

### AI cost and shared learning
| # | Where | Scenario | Proposed fix |
|---|---|---|---|
| P2-19 | `src/app/api/ai/route.ts` | The client sends raw `contents`, `systemInstruction` and file parts; the route is a general model proxy for any signed-in user, bounded only by the allowance. | Named tasks with server-side prompts, as `buddgy/turn` does. |
| P2-20 | `src/lib/server/ai/spendGuard.ts`, voice and SMS settle paths | SMS and receipt are exempt from the global cap; voice is costed at 0 and sized by bytes, not seconds; SMS settles a flat 1500 tokens. | Cost voice by duration; give the exempt features their own ceiling. |
| P2-21 | `src/lib/sms/runAdjudication.ts:44-62`, `sms/parse/route.ts:1615-1624` | The adjudicator model call is not reserved or settled and sets no output limit. | Route it through reserve/settle with a limit. |
| P2-22 | `src/lib/server/aiUsage.ts:12` | The 100-calls-a-day check reads then acts and fails open; learner and categorise calls are outside it. | Use the atomic counter. |
| P2-23 | SQL `upsert_merchant_category` (live definition read) | One user's AI-categorised merchant overwrites the shared `merchant_categories` row unless that row came from a user. One user can set the category every other user gets for a merchant. | Require two users to agree before a shared write, as template promotion does. |
| P2-24 | `src/app/api/ai/buddgy/turn`, receipt, voice | No size cap before the body is read; the caps run after the full read. | Check `content-length` first. |

### Token, queue and device
| # | Where | Scenario | Proposed fix |
|---|---|---|---|
| P2-25 | migrations 0038, 0201; `sms_ingest_tokens` | The token is stored in plain text and the owner can `SELECT` it. A database leak is a token leak. | Store a hash; show the token once at setup. |
| P2-26 | `src/app/api/sms/setup-token/route.ts:54-78`, `tokenCaps.ts:22` | No rate limit and no cap on active tokens per user. | Limit per user per hour; cap active tokens per device. |
| P2-27 | `src/app/api/sms/parse/route.ts` | The 1200-an-hour limit fails open and there is no body size cap before `json()`. | Fail closed; check `content-length`. |
| P2-28 | `src/lib/sms/smsTracker.ts:154-162` | Sign-out ignores a failed token revoke; turning tracking off leaves the token active. | Retry the revoke at next start; revoke on switch-off. |
| P2-29 | device binding | The device id on a token call is attribution only; a token works from any device. | Bind the token to the device id it was issued for. |
| P2-30 | Android WorkManager database, iOS `UserDefaults` | Raw message text waits in plain storage and the iOS spill is not cleared after a drain. | Encrypt at rest; clear after ack. |
| P2-31 | `PendingSmsQueue.read()`; native token save | A parse error reads as an empty queue and the next write overwrites it; nothing checks that only the ingest token is saved natively. | Keep the unreadable file aside; assert the token shape in the one writer. |

### Carried items
- **`sms_parse_log.clean_title`** holds the counterparty's name on transfer rows and outlives the 30-day raw-text retention. Live counts (with a title / older than 30 days): transfer out 166 / 118, transfer in 137 / 102, income 32 / 25, own transfer 8 / 6, refund 6 / 5. Readers are the owner's own screens, the admin log view (behind the open-row permission) and pairing. Proposed fix: null the title on transfer kinds in the same housekeeping job that drops the raw text, keeping the title on the booked row. Needs a decision, section 6.
- **Fixtures.** The name is gone from SMS and crash fixtures. Still present, left alone: the owner's own name in admin permission files, two migrations and admin docs (an account reference, not a fixture), and reference-number and card-digit strings in SMS fixtures that may come from real messages. Proposed fix: replace the digit strings with obviously fake ones in a fixtures-only pass.

## 4. Unconfirmed (no repro)

| # | Where | Suspicion |
|---|---|---|
| U-1 | confirm vs undo routes | **Real, fixed in the route (`f282ecd8`).** Undo could mark a message undone while confirm was still booking it, leaving a live row for an undone message. Confirm's last write now refuses an undone message, removes what it just booked and answers 409. Test: `src/app/api/sms/confirm/route.test.ts` "an undo that lands while the booking is in flight". Not covered: a debt payment or a pair booked in that window is not reversed; the full fix is for confirm to take the same advisory lock as `sms_discard_message` (later). |
| U-2 | `src/lib/server/carryAdjust.ts` | **Real, fixed in SQL (`ec1ad1b2`, migration 0285).** Two different months adjusting the same pocket at once each withdrew against the same earlier balance. `adjust_pocket_balance` now refuses a withdrawal that would go below zero, under its row lock; proven against the live function (the call raised, nothing was written). Test: `src/lib/server/carryAdjust.test.ts`. |
| U-3 | `SmsStore.kt:42-46`, `SmsForwardWorker.kt:65` | Losing the Android keystore key silently empties the queue. |
| U-4 | `SmsCapacitorPlugin.swift:560-562` | One message that keeps getting a 5xx blocks the iOS background drain behind it. |
| U-5 | legacy queue items | **Real in all three drains, fixed (`f282ecd8`).** A queued message with no owner stamp was posted under whoever signed in next. The app drain now drops such items without posting; Android refuses them under a stamped token; iOS background drain requires the owner to match. Tests in `src/lib/native/smsTracker.test.ts`; `SmsGateTest.kt` updated but not run. The Kotlin and Swift parts need a native build to take effect. Cost: a message queued by a very old build before owner stamping is dropped, not delivered. |
| U-6 | template learner | A learned regex goes to global templates keyed on a client-supplied sender; promotion needs 2 users, 50 matches and 7 days, which may be enough. |
| U-7 | `src/lib/sms/correctionExemplar.ts:29-31` | Adjudicated corrections may reach other users' prompts without a second user agreeing. |
| U-8 | bulk enable of templates | Revives templates that were killed; known and accepted in S2d, listed for completeness. |

## 5. Entitlements and billing webhook (design only, no code)

**State today.** One plan (`free`, default, no features, 15 AI units an hour) and no `user_entitlements` rows. The SQL `ai_effective_limits` and the TypeScript resolver agree on lapsed trials and periods.

**What billing will rely on, and the gaps.**
1. **Built in the closing batch (`075fa3f1`):** `requireFeature(userId, key)` in `src/lib/entitlements/server.ts` and `PAID_FEATURES` in `limits.ts` (empty today). Every AI route already passes its feature through `reserveAiQuota`, which now calls `requireFeature` for any key in `PAID_FEATURES`; a failed entitlement read denies a paid key with 503 instead of downgrading silently. S6 adds a key to `PAID_FEATURES` with the route that needs it. Background: plan `features` were not enforced on the server. Only a per-user override of `false` turns an AI surface off. A paid feature gated only in the UI is free to anyone who calls the route. Every paid route needs one server check: `requireFeature(userId, 'x')` next to the existing AI auth.
2. `past_due` grants the plan with no end date. **Rule for S6 (council): access continues for 3 days after `current_period_end`, then drops to the default plan.** Check the 3 days against the store's own retry window when RevenueCat is wired; the grace must not be shorter than the store's billing retry.
3. `canceled` drops access at once, even when the paid period has not ended. **Rule for S6 (council): a canceled plan keeps access until `current_period_end`, in both the SQL `ai_effective_limits` and the TypeScript resolver, with one shared test table for the two.**
4. Limit overrides outlive a lapsed plan.
5. `getUserEntitlements` ignores a query error and falls back to the default plan. For a paying user that is a silent downgrade; it should fail the request or serve the last known value.

**Webhook signature design.**
- Verify on the raw body, before JSON parsing, with HMAC-SHA256 and a constant-time compare. The existing `validSignature` in `src/lib/integrations/sentryWebhook.ts` already does this and can be reused.
- Put the timestamp inside the signed string (`timestamp.body`) and reject anything older than 5 minutes. This also fixes P2-5.
- Idempotency: a table keyed on the provider's event id with a unique constraint; insert first, process only if the insert won. Out-of-order events: store the provider's event time and ignore an event older than the row's last applied one.
- The handler writes `user_entitlements` with the service role only, maps the provider's customer id to a user through a server-written column, and never trusts a user id from the payload unless it is the app user id the server set at purchase.
- Per store: RevenueCat sends a shared secret in the `Authorization` header (compare constant-time, no HMAC); Apple server notifications are signed JWS, verify the certificate chain to Apple's root; Google sends through Pub/Sub, verify the OIDC token's audience and issuer. If RevenueCat is used, only its webhook is needed.
- Answer 2xx only after the write commits, so the provider retries on failure. Log event id and type, never the payload.

## 6. Needs a decision

1. **Grounded search allowance.** Set to 10 a day per user (P1-5). Legitimate callers are the goal and emergency-fund estimates. Pick the number, or tie it to the plan.
2. **Carry deposits in the closed month** (P2-8): should the closed month show the swept amount as saved (phone today) or not (server)?
3. **Counterparty names in `clean_title`**: drop after 30 days with the raw text, or keep as the user's own data?
4. **Shared merchant categories** (P2-23): one user's AI answer sets the category for everyone. Require two users?
5. **Ingest token storage** (P2-25): move to a hash. Existing phones would need a new token.
6. **Plan features on the server** (section 5, item 1): must be decided before the first paid feature ships.
7. **`past_due` grace and `canceled` access**: the two periods in section 5.

## 7. Not verified

- Nothing was run on a device or against the deployed site. All route findings are from code and unit tests.
- The deployment of `bb4e70e4` reports success; no request was made against it. Which earlier commit was the last one live before it is not known (the last successful deployment before 2026-11-14 23:01 was not looked up).
- `npm run verify` cannot catch this class of failure while a checkout's `node_modules` is behind the lockfile; the gate does not run `npm ci` or compare versions.
- **Native edits were not compiled or run:** `PendingSmsQueue.kt`, `SmsGate.kt`, `SmsGateTest.kt`, `SmsCapacitorPlugin.swift`. They need a native build to take effect and to prove they compile.
- The token change was not exercised on a phone: issue, save, forward with the app killed, and switch-off then switch-on.
- The races (P1-1, P1-2, U-1) are proven by tests that simulate the interleaving, not by concurrent requests against a real database. U-2's floor was proven against the live function.
- The Supabase security advisor timed out and was not retried; row security and grants were checked by direct SQL.
- The voice price (100 units a second) and the grounded-search cost are estimates, not read from a bill.
- The limit note on the goal cost sheet and the emergency fund sheet was not looked at in a browser.
- `src/lib/sms/gold/templateReplay.test.ts` timed out once (15 s) when run beside other work; it passed in the full `npm run verify` run.
- No native build was made.

## 8. Council verdicts (2026-11-15)

The owner delegated the section 6 decisions to the council (Skeptic, Pragmatist, Critic). Votes in brackets.

1. **Grounded search allowance: 3 a day on the free plan**, higher on paid plans when they exist (2 of 3; one vote for a flat 10). Show the limit to the user rather than failing silently.
2. **Carry deposits: filter them on the client too**, so the closed month keeps showing the real leftover and the phone and server agree (2 of 3; one vote to document only). This closes P2-8.
3. **`clean_title` on transfer kinds: null it after 30 days** with the raw text; the booked row keeps its title (3 of 3).
4. **Shared merchant categories: two distinct users must agree** before a shared write (3 of 3). Closes P2-23.
5. **Ingest tokens: store a hash now**, before launch; testers re-issue once (3 of 3). Closes P2-25.
6. **Plan features on the server: build `requireFeature` now** and put it on every route that already has a feature key; S6 adds keys for new paid features and no paid route ships without it (2 of 3; one vote to leave it all to S6).
7. **Billing states (design, implemented in S6):** `canceled` keeps access until the period ends (3 of 3); `past_due` gets a 3-day grace after the period end (2 of 3; one vote for 7 days). Check the grace against the store's own retry window when S6 wires RevenueCat.

**P2 triage (3 of 3 for a split, changes by majority).**
- Fix now, in S4: P2-3, 4, 7, 8, 9, 13, 16, 21, 22, 23, 24, 25, 26, 27, 28, 31; P2-20 (voice cost, a ceiling for the exempt features); P2-19 in its cheap form only (model allowlist, output-token and payload caps; the named-tasks refactor stays later); P2-12 and P2-17 only if each is a small fix, otherwise later with the reason written down.
- Later, logged with an owner: P2-1, 2, 5 (with the billing webhook, S6), 6, 10, 11, 14, 15, 18, 29, 30, and the full P2-19 refactor.

**Unconfirmed (3 of 3):** prove or dismiss U-1, U-2 and U-5 with tests now and fix any that are real; leave the other five listed.

## 9. Closing batch (2026-11-15)

Commits: `ec1ad1b2` (database), `f282ecd8` (SMS and tokens), `075fa3f1` (AI and money). `npm run verify` green before the push (5913 tests).

### Decisions (section 8, items 1 to 7)

| # | Decision | Status |
|---|---|---|
| 1 | Grounded search 3 a day, shown to the user | Fixed (`075fa3f1`). The limit is the entitlement `grounded_per_day` (default 3, a plan can raise it). When search is dropped the response carries `x-grounding: limited` and the goal cost sheet and the emergency fund sheet show one line saying live prices were not used. Reused the existing note text styles; no new component. |
| 1b | Found while doing it | The daily counter never worked: the cleanup job deleted every rate counter older than an hour, every ten minutes, so the P1-5 cap reset all day. Fixed in migration 0284 (counters kept 25 hours). The public-site daily lead cap had the same fault. |
| 2 | Carry deposits filtered on the client | Fixed (`075fa3f1`), closes P2-8. |
| 3 | Counterparty names leave after 30 days | **Applied 2026-11-15 on the owner's approval** (the permission check had refused it as destructive; it was first held for the S3 inserts, which take their description from `clean_title`): `supabase/migrations/0286_s4_sms_counterparty_retention.sql`. Counted again just before: 228 rows (119 out, 103 in, 6 own transfer), none waiting for an answer. Checked after: 0 rows past the age still hold a name, `sms_retention` carries the new step once, the migration is recorded. The 84 transfer logs inside the 30 days keep their names until they age out. It clears `clean_title` and also `merchant`, `merchant_normalized` and `raw_sms_summary`, which hold the same name (184 of the 228 rows past the age have `merchant` set), on transfer kinds, skips rows still waiting for an answer, backfills the 228 rows, and adds the same step to `sms_retention`. |
| 4 | Two users must agree on a shared category | Already stricter in the code: a shared row needs five users (the edit trigger) and readers ignore single AI rows. The real gap, an AI answer replacing a seed row and so removing it for everyone, is fixed in migration 0284 (`ec1ad1b2`). Closes P2-23. |
| 5 | Ingest tokens stored as a hash | Fixed (`ec1ad1b2`, `f282ecd8`), phase 1 live: `token_hash` column, backfilled, lookup by hash, new tokens generated on the server and never stored. **Phase 2 (drop the plain `token` column) is not done**: it must wait until this code is deployed, or the old code would stop resolving tokens. |
| 6 | `requireFeature` | Fixed (`075fa3f1`), see section 5. |
| 7 | Billing states | Design written into section 5 for S6. |

**Tester instruction (tokens).** Nothing to do on a phone that already works: open the app once after the update and it fetches a new token by itself. If SMS tracking stops on a phone, open Settings, SMS tracking, switch it off and on. A password change now needs the app to be opened once on each phone before background forwarding resumes (messages wait in the queue meanwhile).

### P2 fix-now list

| Item | Status |
|---|---|
| P2-3 | Fixed (`f282ecd8`): message and code only. |
| P2-4 | Fixed (`075fa3f1`): 20 a minute per user, before the FX fetch. |
| P2-7 | Fixed (`f282ecd8`): own-transfer answers 404 for another user's log. flag-action never answered 403 (a miss is 409), no change. |
| P2-8 | Fixed (`075fa3f1`). |
| P2-9 | Fixed (`075fa3f1`): an excluded templated event is not income; its payday falls back to the projection unless only received money is counted. |
| P2-13 | Fixed (`075fa3f1`) in `src/lib/savings/netWorth.ts` (the path in section 3 was wrong): holdings with no rate are left out and the existing incomplete flag is set. The secondary-currency line a few lines below still uses the 1:1 fallback (later). |
| P2-16 | **Later.** Not the bug it looked like: migration 0197 says `amount` has always been in debt units and backfilled the unit column; every current writer sets it. One live row has a null unit amount. The fallback only matters for rows from old builds, whose amount is already in debt units. |
| P2-19 (cheap form) | Fixed (`075fa3f1`): tier names checked with own-property lookup (inherited names such as `toString` were accepted before), size checked from the header before the read, only three known keys reach the provider, file URIs refused, at most 4 inline parts. |
| P2-20 | Fixed (`075fa3f1`): voice costed by seconds (100 units a second, or bytes at about 32 kbps when the provider gives no duration); SMS and receipt stop at 3 times the daily cap. |
| P2-21 | Fixed (`075fa3f1`, `f282ecd8`): adjudicator calls reserve and settle under the SMS feature with a 400-token output limit. |
| P2-22 | **Later.** The file is `src/lib/sms/aiUsage.ts`. The check counts AI calls from a view; replacing it with the request counter would count every parse, including template-only ones, and could refuse real messages. The overshoot is a few calls from one phone and is now bounded by the reservation and the P2-20 ceiling. |
| P2-23 | Fixed (`ec1ad1b2`), see decision 4. |
| P2-24 | Fixed (`075fa3f1`): 413 from the header before the read on buddgy turn, receipt scan and voice. |
| P2-25 | Fixed, phase 1 (`ec1ad1b2`, `f282ecd8`); phase 2 pending, see decision 5. |
| P2-26 | Fixed (`f282ecd8`): 60 token issues an hour per user, newest 3 active per phone, older ones deactivated. |
| P2-27 | Fixed (`f282ecd8`): 429 when limited, 503 with `Retry-After` when the counter is down, 413 over 64 KB. Both native clients keep the message queued on these, checked in the code. |
| P2-28 | Fixed (`f282ecd8`): a failed revoke is remembered per account and replayed at the next start; switching tracking off revokes this phone's token. TypeScript only. |
| P2-31 | Fixed (`f282ecd8`): Android keeps an unreadable queue aside (**needs a native build**); iOS already did. The token writer refuses anything that is not token-shaped. |
| P2-12 | **Later.** With no Cash account the credit leg has nowhere to go; adding it back would overstate, because later cash spending is not recorded either. Needs an implicit Cash account or a prompt, which is UI work. |
| P2-17 | **Later.** Deducting a deposit with no source needs a per-account start date these rows do not have. The real fix is to require a source in the UI or mark the deposit as declared. |

### Needs a native build to take effect
`android/app/src/main/java/app/buddget/PendingSmsQueue.kt`, `SmsGate.kt`, `android/app/src/test/java/app/buddget/SmsGateTest.kt`, `ios/App/App/SmsCapacitorPlugin.swift`. Not compiled.

### Still open after this batch
1. Migration 0286: done, applied 2026-11-15 (decision 3 above). The patched `sms_retention` job has not yet run on its schedule since.
2. Token phase 2: drop `sms_ingest_tokens.token`. The code that reads the hash is now deployed (`bb4e70e4`), so only the owner's approval is missing (destructive step). Until then the plain tokens issued before this batch are still in the table (new tokens are not).
3. U-1 remainder: confirm should hold the same lock as the undo function.
4. A native build for the four files above.
