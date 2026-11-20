# Implementation report

Labels follow `CLAUDE.md`: **Automated verification** (tests written and passed), **Manual verification required**, **Native verification required**, **Blocked**.

## Step 1: server-only fixes (2026-11-20)

Branch `claude/risk-based-testing-philosophy-9bacd9`. **Not merged to dev or main**: the server code reaches users, including builds already installed, only when it is deployed, and the coordinating session sequences merges to main after the sync, S8a and S-2 branches. Migration 0337 is already **applied on live** (approved plan, item 1.1 slice 1).

| Item | What changed | Files | Status |
|---|---|---|---|
| BDG-011 slice 1 | A call that put nothing in front of the user is logged with its cost but not charged: no credits, no units in any window, nothing on the chat's counter, no Sparks. Covers provider errors, empty replies, safety blocks, and a stream cut or Stop before any text (new status `aborted_empty`). A Stop after text stays charged, and its output is now estimated from the text sent, so Spark users pay for what they read. The per-minute rate limit still counts every call. Budget builds, receipt scans and voice entries that return nothing are free too. | `supabase/migrations/0337_ai_failed_calls_not_charged.sql`, `src/lib/server/ai/buddgy/turn.ts`, `src/lib/server/ai/quota.ts`, `src/app/api/buddgy/turn/route.ts` | SQL: proven on live in a rolled-back transaction, then applied and checked (one function, same signature, `service_role` only). Code: **Automated verification** (runner jobs 3 and 4, `npm run verify` green on `3f57e6ac`). |
| BDG-013 server part | The server never sends the spend flag, so no client cuts Buddgy's memory to 2 items or shows "this chat is getting long", including builds already installed. | `src/app/api/buddgy/turn/route.ts` | **Automated verification** (runner jobs 3 and 4). |

What changes for users at once: since 0337 is live, today's deployed server already stops charging `error` calls. `aborted_empty` and the spend-flag change take effect when this branch is deployed.

Known limit, marked in the migration: a prompt the provider blocks on safety is now free, so it can be repeated at no credit cost. The per-minute limit (10 a minute on Free) still applies.

## Tests for step 1
| File | Case | Result |
|---|---|---|
| `src/lib/server/ai/buddgy/__tests__/gateway.test.ts` | stall before text settles `aborted_empty` (expectation changed from `aborted` on purpose) | passed (runner jobs 3 and 4) |
| same | stall after 40 characters settles `aborted` with 10 output tokens | passed (runner jobs 3 and 4) |
| same | user Stop before text `aborted_empty`, after text `aborted` with output above 0 | passed (runner jobs 3 and 4) |
| `src/app/api/buddgy/turn/route.test.ts` | chat past its spend line still gets `soft: false`, the turn ends `done`, settles `ok` | passed (runner jobs 3 and 4) |
| live SQL, rolled back | `ok` and `aborted`: 5000 units, 2.5 credits each. `error` and `aborted_empty`: 0 units, 0 credits, cost still logged. Chat counter 10000. Rate limit counted 4 rows. | **passed** |

## Step 2: Buddgy usage, limits and label (2026-11-20)

Client and server code. Reaches phones only with the next native build; the server part (label on the meta frame) when this branch is deployed.

| Item | What changed | Files | Status |
|---|---|---|---|
| BDG-009, 016 | The usage ring in the chat opens the existing limit sheet on top of the chat (new notice key `usage_view`): both meters with reset lines, the plan, and the offers a limit would make (Free: Sparks and Pro; Pro and trial: Sparks only), plus "See all usage". The chat, its draft and a streaming reply stay as they are. Any button in that sheet that opens a page ("Go Pro", "See all usage") closes the chat first, so nothing opens behind it. | `QuotaWheel.tsx`, `NoticeHost.tsx`, `usageNotices.ts`, `usageCopy.ts` | Rules: **Automated verification** (runner jobs 3 and 4). The visible sheet: **Manual verification required** (no browser test written: the chat needs a signed-in, billing-on session; the 10-screens journey is the place to add one). |
| BDG-012 | One formatter for "when it is back": a clock time later today, otherwise day, date and time. Used in the chat's limit message and under each meter; at 100% the meter says "Limit reached · Resets …" instead of only "Limit reached". A per-minute rate block has its own message ("Give me a minute") and keeps Retry. In the chat a blocked turn shows the sheet every time, not once per app session. | `format.ts`, `buddgyChatCopy.ts`, `AIChatMessageList.tsx`, `NoticeHost.tsx`, `usageNotices.ts` | **Automated verification** (runner jobs 3 and 4). |
| BDG-010 | The server says how each reply was made: `thinking` only when the thinking budget is above the minimal level; the free Advisor answer, which runs at the minimal level, is labelled Quick. Shown as a small word on the reply's footer line, before "Checked: …". | `gemini.ts`, `route.ts`, `protocol.ts`, `runTurn.ts`, `chatTypes.ts`, `useBuddgyChat.ts`, `AIChatMessageList.tsx`, `buddgyChatCopy.ts` | Route test checks `mode: 'quick'`: **Automated verification** (runner jobs 3 and 4). The visible label: **Manual verification required**. |

Not changed on purpose: times are shown in the phone's own time zone, which is always the reader's, so no zone name is added. The model's name is not shown, only Quick or Thinking: both tiers run the same model today.

## Step 3: BDG-011 slice 2, one charge per user message (2026-11-20)

Migration `0338_ai_one_charge_per_turn.sql` is applied on live. The server already deployed and installed builds send no turn id, so they keep the 0337 rule unchanged. The per-turn rule applies once this branch is deployed (server) and the next native build ships (the phone sends the turn id).

**How a turn is charged:**
- The phone makes one id per user message. It sends the same id on every tool step and on Retry.
- **Tool steps are provisional.** A tool step is a call that asks the phone for data while hops are left.
  - Their credits are counted as before.
  - Sparks are charged once, when the turn closes, on the summed cost. Before this change each step cost at least one Spark of its own.
- **The final call decides.**
  - If the whole turn showed nothing (no text, no proposal, no navigation) and ends in an error or an empty cut, it is free in full. Its tool steps are made exempt and their units come off the chat.
  - Otherwise the turn is charged once.
- **Retry** of a turn that was already charged gets one free re-run: no credit check, no Sparks, no units, and it does not count as a chat turn. A third attempt is paid. The per-minute rate limit and the unit safety windows still apply.
- **A turn left open** (the phone stopped between steps) is charged when the next message arrives. Only a failure the server itself saw makes a turn free.
- **Hops inherit their funding** (credits or Sparks) from the turn's first call.

**Readings that need the owner's sign-off:**
- "A turn whose actions were applied is charged" is read as "a proposal or navigation was shown". Applying happens later on the phone, where the server cannot see it.
- A free re-run replays the model rather than returning a stored answer. Nothing stores reply text today.

| Item | Files | Status |
|---|---|---|
| SQL: `ai_turns` table, `turn_id` on reservations and events, reserve and settle rules | `supabase/migrations/0338_ai_one_charge_per_turn.sql`, `database.types.ts` | Proven on live in a rolled-back transaction (6 cases below), then applied. Each function has one signature and `service_role` only. `EXPLAIN` of both new queries uses the new indexes. Advisors report nothing new. |
| Route: turn id to reserve; tool step and "seen" to settle | `route.ts`, `turn.ts`, `quota.ts`, `validate.ts`, `protocol.ts` | Tests written, **not yet run** (job 5) |
| Phone: one turn id per message, reused by Retry | `useBuddgyChat.ts`, `runTurn.ts`, `chatTypes.ts` | Tests written, **not yet run** (job 5). Retry on a device: **Native verification required**. |

## Tests for step 3

**Live SQL, rolled back: passed.**

| Case | Result |
|---|---|
| No turn id | Unchanged |
| Two lookups and an answer on Sparks | One Spark charge on the summed cost |
| Lookup, then the final call fails | Turn free, all rows exempt with the cost logged, chat units back to 0, no Sparks |
| Stop after text | Charged once |
| Retry of a charged turn | Free re-run: units 0, chat turns unchanged, no Sparks. The third attempt is paid. |
| Open turn followed by a new message | Charged |

**Unit tests: pending runner (job 5).**
- `quota.test.ts`:
  - turn id and tool-step facts are sent only for a turn
  - every RPC parameter name exists in the latest SQL signature (guards against the silent fallback to v1)
- `route.test.ts`:
  - a lookup settles as provisional and not seen
  - an answer settles as final and seen
  - no turn id means per request
  - a turn id that is not a uuid gets 400
- `gateway.test.ts`: the outcome carries the text length and the tool names
- `runTurn.test.ts`: the same turn id goes on every hop, and none is sent when absent
- `sqlContracts.test.ts`: pins the 0338 rules

## Step 1.4: BDG-019 "Keep Pro" (2026-11-20)

Branch `claude/heuristic-williamson-2cfe0c`, cut from `origin/main` (`50927050`), because main carries billing changes this program's branch does not. **Not merged to dev or main**; the coordinating session sequences merges. Expect an add/add on this file when the branches meet: keep both tails. No migration.

Client code reaches phones only with the next native build. The new route works when this branch is deployed **and** the owner sets `REVENUECAT_SECRET_KEY` on Vercel. Without the key, the route answers 503 and the app keeps showing "Confirming with the store…". Installed builds (iOS 146, Android vc180) never call the route, so nothing changes for them.

**Revised the same day: the route moved from RevenueCat REST v1 to v2** (owner-approved, see "REST v2" below). Runner job 6 tested `91c28c00`, the v1 route. Runner job 1.4-B tested `6292215a`, the v2 route: the 7 billing files passed 76 of 76, and `npm run verify` was green at every stage (6674 passed, 0 failed, in both Cairo and New York). Runner job 6 (branch at `91c28c00`): the 7 billing test files passed, 75 of 75. `npm run verify` was green at every stage: lint with 0 errors, types, Cairo and New York tests (6673 passed, 0 failed), coverage floor, migration check, dependency audit, and the production build.

| Item | What changed | Files | Label |
|---|---|---|---|
| Packages after configure, with retry | The SDK now reports `idle`, `starting`, `ready` or `failed` to listeners. The buy screens load packages when it becomes `ready`, and again on each later `ready` (for example after a user switch). They no longer load once on mount. An empty or failed offerings answer is asked again twice before giving up. A configure, log-in or offerings call that never answers ends as a failure after 20 or 12 seconds, so no button spins forever. | `purchases.ts`, `usePlanPurchase.ts` | Logic: **Automated verification** (runner job 6). Whether this was the cause on the owner's phone: **Native verification required** (RevenueCat debug log) |
| Configure failure surfaced | A refused `configure` or `logIn` is thrown, logged to the console as `[billing] store setup failed` (it appears in the Xcode device log), and reported to Sentry under `billing.configure`. The SDK is left `failed`, and the screen shows that state. It is no longer swallowed. | `billingSession.ts`, `purchases.ts` | Same as above |
| Button and status line | The buy button (trial "Keep Pro", Change plan sheet, Free plans) shows its spinner while the store is starting or the packages are loading. Under the button, one line says, in this order: "Confirming with the store…" with Check again; else the result of the last tap; else "Buying isn't available on this device yet…" with Retry, where a retry can help (the store key is present). Retry starts the SDK again if it failed, otherwise it asks for the packages again. A tap on a plan the store did not list says so instead of nothing. Restore answers under the manage bar on the page, and under the buy button inside the plans sheet. | `PlansView.tsx` (`usePlanChoice`, new `BuyLine`), `ProStateView.tsx`, `purchaseFlow.ts` (`buyLineKind`) | Order: **Automated verification** (runner job 6). Look and placement: **Manual verification required** |
| "Welcome to Pro" only from a store | Success means `/me` shows `subscription.fromStore` **and** Pro still active (`storeConfirmed`). A lapsed store row and a trial do not count. `refreshUntilPaid` stopped at any plan other than Free, so a trial passed it at once. It is replaced by `refreshUntilStore`, and `isPaidPlan` is removed (it had no other user). If the webhook is not there after about 4 seconds, the app asks the new route once. On a miss the buyer sees "Payment received. Confirming with the store…" with **Check again**, never Welcome. The Pro page also gates Welcome on `storeConfirmed`. Welcome hides the empty "Member since" fact until the webhook's row gives it a date. | `billingStore.ts`, `purchaseFlow.ts`, `usePlanPurchase.ts`, `settings/pro/page.tsx`, `ProStateView.tsx` | **Automated verification** (runner job 6) |
| Restore | Restore asks the route to read RevenueCat. It says "Restored" only when store Pro shows now and did not before the tap, and "Nothing to restore." otherwise (new copy, en and ar). | `purchaseFlow.ts`, `membershipCopy.ts`, dictionaries | **Automated verification** (runner job 6) |
| On-demand store read | New `POST /api/billing/sync` on REST v2 (details below). | `src/app/api/billing/sync/route.ts`, `src/lib/billing/revenuecatSync.ts`, `.env.example` | Route on v2: **Automated verification** (runner job 1.4-B). Against RevenueCat: **Blocked** until the key is on Vercel |
| End-to-end sandbox purchase | Not run | | **Native verification required** (next build, owner's phone, RevenueCat debug log) |

How `POST /api/billing/sync` works:
- **Who it reads:** the signed-in user only, from the session, never from the request body.
- **When it runs:** only from user actions: after a purchase the webhook has not confirmed yet, on Check again, and on Restore. Never on a plain read, never from `BillingHost`.
- **Request:** `GET https://api.revenuecat.com/v2/projects/{REVENUECAT_PROJECT_ID}/customers/{user id}/subscriptions?limit=100`, sent with `Authorization: Bearer <REVENUECAT_SECRET_KEY>` and an 8-second timeout.
  - The key needs only the Customer information read permission (`customer_information:subscriptions:read`).
  - The project id defaults to `projb9480b99`.
  - A 404 (customer unknown to RevenueCat) answers `none`.
- **Limits:** 6 calls a minute per user (fails open, so a counter outage cannot strand a buyer). Answers `billing_off` while selling is off.
- **What counts:** only a subscription RevenueCat marks `gives_access`, from App Store or Play, whose product is Pro. It goes through the webhook's own `planEffects` and `billing_apply`.
  - v2 gives RevenueCat's product id, not the store's.
  - The store id (`pro_monthly`) comes from the subscription's entitlement product list (`store_identifier`).
  - If that list doesn't name the product, a small catalogue map in `revenuecatSync.ts` is used. It was read with the RevenueCat MCP `list-products` on 2026-11-20: `prodc5ccfbb979` is `pro_monthly`, `prod0ad078c15f` is `pro_annual`. Play products must be added there when they exist.
- **Never removes access.** No live subscription means no write, so a trial is never ended by it. Expiries and refunds still come only from the webhook.
- **Access only, no Sparks.** It writes the Pro entitlement and the store country (`country`, which sets the Egypt limits). It does not open a Sparks period and does not end the trial's Sparks; both stay with the webhook. `spark_allowances` is unique on the exact period start. Unless both paths stamped the same millisecond, both periods would be granted.
- **Repeat taps:**
  - The event is stamped at the period start (`current_period_starts_at`), with id `sync:<user>:<store product>:<period start ms>:<active|canceled|issue>`.
  - Canceled means `auto_renewal_status` is `will_not_renew`.
  - Issue means `status` is `in_billing_retry` or `in_grace_period`. The grace end is `ends_at`.
  - A repeat tap in the same state is `duplicate`.
  - A later read of the same period in another state applies, unless a webhook has already written something newer (then it is `stale`, and the webhook's state stands).
  - The real webhook still applies after a sync, since its timestamp is later.
- **Billing log:** the event's type is `SYNC_PURCHASE`, which the history (`INITIAL_PURCHASE`, `RENEWAL`) does not list. When the webhook lands, its own row is the one shown.
- **Sandbox:** `environment` is `sandbox`. `REVENUECAT_IGNORE_SANDBOX` is honoured as in the webhook.
- **Why v2:** a v1 secret key always has full access. The v2 key the owner created is read-only (Customer information read only, every other section No access, no token issuing). RevenueCat's v2 docs say v1 keys do not work on v2, and nothing says a v2 key works on v1. The v2 subscription has no refund field and no store price, so a refund still comes only from the webhook, and the receipt price stays null until the webhook brings it.

Known limits:
- **Shape not checked against a live customer.** The RevenueCat project has no customers yet (MCP `list-customers`, 2026-11-20).
  - The v2 fields used are `items[].product_id`, `store`, `environment`, `gives_access`, `status`, `auto_renewal_status`, `current_period_starts_at`, `current_period_ends_at`, `ends_at`, `country`, and `entitlements.items[].products.items[].store_identifier`. They come from the v2 Subscription data model page; the fixture copies the documented shape.
  - The docs don't say outright that the v2 `customer_id` is the app user id (the Supabase user id the SDK is configured with). The first sandbox buy is the check.
- **Until the webhook lands, a buyer has Pro but not everything else.** Missing: the plan's Sparks, `store_original_txn`, the receipt row and its price, and "Member since". If webhooks stay broken, Pro works but Sparks never arrive. The webhook secrets are the fix for that, not this route.
- **This is not a reconcile.** BDG-020's "cancelled only once the store confirms" needs a path that also takes access away. This route never does, so BDG-020 cannot reuse it as is.
- **The cancelled banner's "Keep Pro"** (store page, `managementURL`) is BDG-020, not this step.

Sandbox checklist for the owner's device run:
1. With RevenueCat debug logging on, open Settings > buddget Pro as a trial user. The log must show `configure`, then offerings with two packages. The button spins, then sells.
2. Buy in sandbox. Welcome to Pro appears only after the server shows store Pro. `billing_events` gets an `INITIAL_PURCHASE` row (webhook) or a `SYNC_PURCHASE` row (this route).
3. After the webhook lands, `spark_allowances` holds exactly one `plan` row for this user and period.
4. Tap Restore again: "Nothing to restore."

Owner actions:
1. Set `REVENUECAT_SECRET_KEY` on Vercel to the v2 secret key: Customer information read only, every other section No access, Issue token unticked. `REVENUECAT_PROJECT_ID` is optional; the default is `projb9480b99`.
2. Check the two webhook secrets on Vercel. Without them every webhook gets 503, and this route is the only way a buyer gets Pro.

## Tests for step 1.4
| File | Case | Result |
|---|---|---|
| `src/lib/billing/purchaseFlow.test.ts` (new, row 36 of `08-playwright-test-plan.md`) | `storeConfirmed`: trial no, lapsed store row no, active store row yes | passed (runner job 6) |
| same | `shelfOf`: loading only while starting or fetching; unavailable for no store, a failed SDK, or no packages | passed (runner job 6) |
| same | `buyLineKind`: confirming first, then the last tap's note, then "not available" | passed (runner job 6) |
| same | a trial that stays a trial on the server is `pending`, not confirmed (failed before this change) | passed (runner job 6) |
| same | confirmed by the webhook without a store read; a missed webhook recovered by one store read; cancelled and failed touch nothing | passed (runner job 6) |
| same | Restore: "nothing" for a trial when the store has nothing, "nothing" when store Pro was already there, "restored" when the read brings it, a failed restore asks nothing | passed (runner job 6) |
| `src/lib/billing/purchases.test.ts` | status `starting` then `ready`, `idle` after sign-out; a refused configure throws and leaves `failed`; Retry configures again as the same user; retry with nobody does nothing; empty or failed offerings asked again, then give up | passed (runner job 6) |
| `src/components/features/billing/billingGate.test.tsx` | a refused configure is reported to `captureAppError('billing.configure')` | passed (runner job 6) |
| `src/lib/billing/billingStore.test.ts` | `refreshUntilStore` replaces `refreshUntilPaid`. Changed on purpose: a trial no longer ends the wait. | passed (runner job 6) |
| `src/app/api/billing/sync/route.test.ts` (new; rewritten for v2 with a fixture in the v2 Subscription shape) | The v1 version passed in runner job 6. The v2 version covers: 401 without a session; 503 without the key; reads only the signed-in customer's v2 subscriptions in the project with the Bearer key; event at the period start, typed `SYNC_PURCHASE`, access and country only (no Sparks, no trial end, no price); store id from the entitlement products, else the catalogue map; a repeat tap is the same id; nothing written for no access, promotional, a Sparks product, an unknown product, or a 404; `will_not_renew` and grace period kept under their own ids; sandbox from `environment`; 429, 502, billing off | passed (runner job 1.4-B, 10 of 10) |

Checked on the Mac (no test runner): `tsc --noEmit` clean and `eslint` clean on the changed folders. Runner job 6: the 7 billing files passed 75 of 75, and `npm run verify` was green.
