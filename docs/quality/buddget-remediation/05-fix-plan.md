# Fix plan (revision 2, after the independent audit)

Status: **proposed, nothing built.** Root causes: `03-root-cause-analysis.md`. Exact `path:line` evidence: `findings/`. Decisions: `06-council-review.md`. What the audit changed: `07-independent-plan-audit.md`.

Rules for every item: one root cause at a time; migration first, applied, types regenerated, then code; new migrations are numbered **0337 and up** (live already holds 0331 and 0334 to 0336 from unmerged branches); new SQL functions get `EXECUTE` for the narrowest role only; reuse existing components; Arabic and English; light and dark; safe areas.

**Installed builds matter.** iOS 146 and Android vc180 keep talking to the same server and database until testers update. Every server or database change below states what it does to them. Where a defect can be fixed on the server, it is fixed there, so installed builds benefit without a rebuild.

Test tier: **DT** tests mandatory, **CX** targeted test, **UI** mockup then owner review, **N** device check. Size: S under half a day, M one to two days, L more.

## Phase 0. Preconditions (not this program's code)

| # | What | Who | Why it blocks |
|---|---|---|---|
| P-a | Results of runner jobs 18 to 21; then merge sync, S8a, S-2 in that order. **Do not merge sync on a green that only waited longer:** the two-device mismatch (R14) has no app-code fix on that branch, only a longer wait in the test. | owner pastes results; the coordinating session merges | BDG-001 edits the same sync files; live already has those migrations |
| P-b | App Store Connect: Paid Apps agreement, banking, tax all Active. In-App Purchase key uploaded to RevenueCat. `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_WEBHOOK_HMAC_SECRET` set on Vercel. | owner | Without them no purchase completes and no store event arrives |
| P-c | A cloud QA runner this session can reach | owner | Every test run goes there |

## Phase 1. Correctness (P1)

### 1.1 BDG-011 Buddgy charging, in two slices (DT, Opus)

**Slice 1: server only, safe for installed builds (M).**
- In `ai_quota_settle_core`: when the status is `error`, or `aborted` with no text sent to the user, write `credits_exempt = true`, add nothing to `ai_chats.units`, and charge no Sparks. The real provider cost is still logged.
- The route passes "text was sent" to settle (the stream knows it; token counts arrive too late to judge it).
- The per-minute rate check keeps counting exempt rows, so exemptions cannot be farmed.
- Every failure draws a visible bubble with Retry (client; arrives with the next build).
- A daily check on the chat error share per model, reported through the existing admin alerts. The November silence lasted 8 days because nothing watched it.
- **Migration:** yes, changed functions only. If a parameter is added, drop the old signature in the same migration and grant `EXECUTE` to `service_role` only.
- **Installed builds:** same requests, fairer charge. No change needed in the app.

**Slice 2: one charge per user message (L).**
- A `turn_id` and `attempt` on every model call of one user message. Tool steps are provisional; the final outcome decides. Sparks are charged once per turn, not once per tool step (`ai_quota_settle`, `spark_charge`).
- A request **without** a `turn_id` (installed builds) keeps today's per-request rule plus slice 1. It never gets free tool steps.
- Retry reuses the `turn_id`. If the server finished a turn but the client never received the end (cut stream), Retry returns the stored answer or one free re-run; it is never refused and never charged twice.
- A turn whose actions were applied is charged even if its last call failed. A tool-step frame that carried visible text counts as text.
- Turns left open are closed on the user's next reserve (no new scheduled job).
- **Migration:** yes. Columns on `ai_usage_events` and `ai_reservations`, index `(user_id, turn_id)`, changed reserve and settle functions. `EXPLAIN` the window query before and after.
- **Policy (owner signs off):** free = provider error, timeout, empty reply, safety block with no text, stream cut or Stop before any text. Charged = any visible text (including Stop after partial text and a written refusal) or any applied action.
- **Tests:** see `08`. Includes: old client with no `turn_id`; Sparks once per turn; Stop after streamed text; cut-stream Retry.

### 1.2 BDG-013 "Chat is getting long" (DT, M, Opus) — independent of 1.1, can go first
- **Server:** stop sending the spend flag to the client (`route.ts:108`). Installed builds then stop cutting history to 2 items, with no rebuild.
- **Client:** remove the note. Replace the fixed window with a size-based one that never drops below a set number of turns kept verbatim (today everything older than 3 turns becomes a 70-character snippet inside a 1,000-character carry, so short chats already lose detail). Honour the hard roll and carry the recap silently. Stop routing budget phrases to the costly tier by default.
- **Hard cap:** it is also a spend line (60,000 units, about 8 calls). Slice 1 of 1.1 stops failed calls feeding it. Whether to move it from spend to size is decided from the before-and-after numbers.
- **Second slice, only if the numbers justify it:** send only the tools the intent needs. Today: 14% of the prompt cached, 7,634 units per call.
- **Files:** `src/lib/buddgy/client/history.ts`, `useBuddgyChat.ts`, the turn route, `classifyIntent.ts`, chat copy. **Migration:** none.
- **Cost warning:** keeping more history raises units per turn, so Free users (6 credits a session) reach their limit sooner. Measure on live before and after.
- **Owner decision:** keep the chat across a reload and past 30 idle minutes?

### 1.3 BDG-001 Theme and settings (DT, M, Opus) — after P-a
- **Change 1:** add `system` to the `theme_mode` enum (a lone statement) and upload it as is; remove the mapping to `dark`.
- **Change 2:** the client's fallback settings are `dark` (`sync.ts:69`, `snapshot.ts:80`). Set them to `light`, matching the live column default (checked: `light`), and make a pull keep the local theme when the server has no row. This is the "a default gets restored" path.
- **Change 3, decided by a mandatory test:** two devices, where device B behaves like an installed build (stale, and uploading `dark` for System). If B can still overwrite A's newer choice after the sync merge, bring `user_settings` under the existing edit-stamp rule. If that rule is built, installed builds' rejected uploads must fail quietly.
- **Honest status:** the System-to-dark mapping is confirmed, but the owner set **light**, which that mapping alone does not explain unless the tile passed through System. Changes 2 and 3 cover the other two candidates.
- **Simpler alternative for the owner:** drop System from the tile (no migration). The Council advised against removing a feature people expect.
- **Installed builds:** they accept `system` from the server (they pass the value through and know System locally), but keep uploading `dark` for System until updated.

### 1.4 BDG-019 "Keep Pro" (DT + N, M, Opus)
- Load store packages after the SDK is configured and retry on failure; surface a configure failure instead of swallowing it; loading state on the button; "Buying isn't available" next to the button with Retry.
- "Welcome to Pro" only when the server says the entitlement comes from a store (the existing `fromStore` flag on `/me`), not because a trial already counts as paid. Restore says "Nothing to restore" when nothing changed.
- **Because webhooks have delivered nothing in 30 days:** "Confirming with the store…" gets a refresh that asks RevenueCat for this subscriber on demand (server side, user-triggered, not on every read). Without it a missed webhook strands a real buyer.
- **Files:** `ProStateView.tsx`, `usePlanPurchase.ts`, `purchases.ts`, `billingSession.ts`, `billingStore.ts`, one server route. **Migration:** none.
- **Not proven:** why no package loads on the owner's phone. Store-side setup (P-b) is the leading explanation. End-to-end proof needs P-b and a sandbox purchase on a device; until then this item is **Blocked**, not tested.

### 1.5 BDG-008 SMS setup and device state (DT + N, L, Opus)
- **Five separate facts, never merged:** preference (account); **claimed** (the user finished the guide or confirmed the skip, on this phone); **run seen** (the Shortcut action ran on this phone); **verified** (the first SMS from this phone reached the server); health (time since the last SMS from this phone). A token alone no longer counts as anything.
- **UI:** one implementation for Settings and onboarding. Finish says "Not confirmed yet" until verified, never "Automation active". Setup is not marked claimed when the token fetch failed. The guide gets "Shortcuts already exist? Skip guide" with a confirm. X moves inside the header row. Health copy is neutral and never says "deleted".
- **Which fact shows the switch instead of "Set up":** owner decision. The brief says only "claimed". The Council says "run seen" should count too, because a run is the only proof iOS ever gives that the Shortcut exists.
- **Pill:** this phone's `last_sms_at`. Phones on an older token with no device id keep the account-level reading, so they do not drop to "waiting".
- **Server:** a new device row no longer forces collecting off against the account preference (`registry.ts:74`); installed builds benefit.
- **Migration:** yes. `user_devices.first_sms_at`, set where `last_sms_at` is written (`parse/route.ts:807`). Backfill from `sms_parse_log`: earliest row per `(user_id, device_id)`, refusal rows excluded, in batches with a short statement timeout, `EXPLAIN` first.
- **Unsourced:** that iOS cannot list or inspect Shortcuts. Apple pages were fetched; none states it. The design assumes it and shows only what a run or an SMS proves.

## Phase 2. Interactions (P2)

| ID | Change | Tier, size | Test |
|---|---|---|---|
| BDG-009, 016 | The ring opens the existing limit sheet above the chat through a new notice key that is exempt from the once-per-session rule. Usage stays a sheet; "Go Pro" and "Full usage page" close the chat first, then navigate. | CX, S | Journey: draft kept, path unchanged, repeatable |
| BDG-012 | One reset formatter (weekday, date, time, timezone when it differs from the device); "Limit reached · resets …"; a rate block gets its own line and Retry; the sheet shows on every blocked turn in chat. | CX, S | Unit on formatter and notice rules |
| BDG-010 | The label comes from what actually ran: model and thinking level, reported by the server on the frame sent once the model is final. The free Advisor answer is not labelled "Thinking" while it runs at Quick's level. No user switch unless the owner asks. | CX, S | Unit: a fallback reports the fallback model; label follows thinking level |
| BDG-015 | Effect class for each of the 67 tools (the classification exists in `findings/C2`). Navigate or start a flow: a card that names the destination; consent per chat and destination, reset by "New chat"; the chat closes on navigation and reopens from the orb with its conversation. Explicit "open X" navigates at once. Tools that write financial data or settings keep a confirm rule, now covered by tests. "Build my budget here": owner decision. | CX, DT for writes, M | Unit: `start_budget_setup` with consent returns a card; every tool has a class; write tools cannot apply without their rule |
| BDG-014 | Panel geometry from the visual viewport; no nav clearance while the keyboard is up; the orb's `fit()` never saves during the keyboard. No Keyboard plugin. | CX + N, S | Unit on the geometry helper; device |
| BDG-017 | **Step 1, spike on a device:** WKWebView's own back swipe (one line of Swift). **Step 2:** back controls on Goals, Reports, Subscriptions, Notifications, Budget plan and the Settings hub, with one `goBack()` shared with the Android handler (guards first, never leaves the app, keeps scroll). **Step 3, only if the spike fails:** a scripted left-edge swipe, iOS only (on Android it would clash with the system back gesture). | CX + N, M | Unit on `goBack()`; device |
| BDG-020 | One "Manage subscription" button and sheet; rows by store and state. Cancel = optional stay step with equal-weight buttons, then the store's own page; "cancelled" only once the store confirms, with the same on-demand refresh as 1.4. Trial users see "trial ends on …". "Choose plan" selects and starts the purchase. | DT, M | Unit on rows per state; API for `/me`; end to end **Blocked** on P-b |
| BDG-003 | Hide the far face at 90 degrees in the rig's paint step; backface rule on the painted face; dim filter off the wrapper. One change, four cards. | CX + N, S | Unit on face visibility; the iPhone check is the real proof |
| BDG-018 | Orb follows the finger in both axes and springs to the nearest edge, with a small dead zone near the middle; limits from safe areas, tab bar and keyboard; mirrors in Arabic; remembers its side. Hint: owner decision (the Council dropped it as unnecessary once the orb follows the finger; the auditor wants it kept). | CX, S | Unit on snap side, limits, mirroring |

## Phase 3. Visual and small (P3): mockup first, owner approves, then build

| ID | Change | Needs from owner |
|---|---|---|
| BDG-002 | Label the bar ("Finish setup, 3 of 5"), open the existing checklist, count only steps that apply to the platform (unit test updated) | "setup" or true profile completion |
| BDG-023 | Move biometrics and App lock together; registry entries and hub subtitle | target screen (the data screen also serves signed-out users, which the toggle cannot) |
| BDG-004, 006 | "37 Days of Pro", "From {first name}", truthful steps, "On its way" not used for held friends, Arabic labels translated | qualifier on "37 days"; short real code or sample only |
| BDG-005 | Recommendation: no expiry; landing page before any share image | yes or no |
| BDG-007 | No "this week" ring at zero; strip pinned left to right | calendar or progress meter |
| BDG-021 | Sheet interiors on tokens: grouped surfaces, pinned footer, equal-weight buttons | none |
| BDG-024 | Neutral bank icon now; per-bank logos only on the owner's decision | licensing; account mark on transaction rows is a new feature: wanted? |
| BDG-025 | **Design-system alert.** Either a second look on the existing `CardFaceChip` (smallest), or one shared card-face component replacing the hand-drawn faces (touches existing components). Stacked presentation and no network names in both. | which of the two |
| BDG-026, 027, 028 | **Design-system alert, ruling needed before any build.** The owner asked for the provider-style selector. It is hard-wired to payment brands and cannot take pockets or accounts without being reshaped. Options: (a) `SelectField` with three additive props, and change the design-system line that forbids it for accounts; (b) a new option-picker sheet; (c) keep the account picker and fix only "Into". Then build "Add pocket" once, on the chosen picker, as a nested sheet that returns the new id and keeps the amount. | a, b or c |

## Deferred behind a written launch gate
- **BDG-022** cross-store ownership, purchase guard, daily reconcile job. Required **before** Google Play or any web checkout is switched on. `billing_apply` already rejects events older than the last one applied, so out-of-order events from one store are handled today.
- **A web payment rail and Android selling.** Neither exists in code. Both are new projects and owner decisions, not fixes.
- **BDG-H2** stays with the sync session; this program adds no sync code except 1.3.

## Needs the owner before any work
The brief asks for approval before migrations, reward-rule changes, security changes and deployments, so these are gated here even though the project rules have no general approval step.
1. Migrations: `theme_mode` value; Buddgy settle change (slice 1) and `turn_id` (slice 2); `user_devices.first_sms_at` with backfill.
2. Buddgy charging policy, including a written refusal, and whether to reset testers' AI windows once.
3. Which fact turns "Set up" into the switch.
4. The two design-system rulings (card face, picker).
5. The Phase 3 questions in the table.
6. A native build at the end. Nothing here deploys by itself.

## Build order
1. Phase 0.
2. Server-only first, because installed builds benefit at once: 1.2 server part, 1.1 slice 1, the SMS server precedence fix.
3. In parallel, separate files: **(a)** 1.1 slice 2 then the rest of 1.2; **(b)** 1.5; **(c)** 1.3 once P-a lands; **(d)** 1.4.
4. Phase 2: chat items as one group (009, 012, 010, 015, 014, 018), billing 020 after 1.4, then 017, 003.
5. Phase 3 after mockups and rulings.
6. One native build, then the device checklist in `10-native-test-requirements.md`.
