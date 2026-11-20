# Independent plan audit

Auditor: independent reviewer, read-only, 2026-11-20. Inputs: `01`, `02`, `03`, `04`, `05`, the `findings/` files where a claim needed checking, and `CLAUDE.md`. I did not read `06-council-review.md` or `council-packet.md`. I had no database or network access, so every live-data claim (row counts, live enum, column defaults, 0 RevenueCat events) is **taken from the findings and not checked**. "Verified" below means I read the code at that line.

## A. Root-cause verification

| ID | Verdict | Evidence I read | What is off |
|---|---|---|---|
| BDG-001 | **Partly** | `settingsMapper.ts:8` maps `system` to `dark`; `settingsMapper.ts:46` copies `row.theme` back; `delta.ts:186-193` replaces local settings with the server row unless an unsent edit exists; `merge.ts:56` full-pull fallback takes `server.settings` unconditionally; `database.types.ts:7172` enum is `"dark" \| "light"`. | The mechanism is real, but the owner reported setting **light**, not System. R1 only explains a revert if the tile passed through System. R2 (whole-row last-write-wins from a stale device or R17 re-post) fits "light" better and the plan makes it conditional. The analysis also under-weights the client-side **dark defaults**: `defaultServerSettings` `sync.ts:69` and `emptySnapshot` `snapshot.ts:80` are both `theme: 'dark'`, used at `sync.ts:497,568` and as the baseline in `flushedFingerprint.ts:67`, `SupabaseFinanceSync.ts:339`. That is the "a default gets restored" path the owner forbade. |
| BDG-008 | **Verified** | `SmsCapacitorPlugin.swift:531` `isWired = isSetupCompleted \|\| lastRunAt != nil \|\| token != nil`; `CatchBankSmsIntent.swift:35-36` stamps `recordRun` before the enabled gate; `useSmsTracking.ts:124-131` reads newest `sms_parse_log` by `user_id` only (its comment at `:117-119` claims the opposite); `registry.ts:74` inserts `collects_sms = report.collects ?? false`; 0179:11 `collects_sms boolean NOT NULL DEFAULT false`. | One gap: `parse/route.ts:807` writes `last_sms_at` only `if (logRow && deviceId)`. Phones on a legacy token with no device id never get a per-device timestamp, so moving the pill to per-device data regresses them to "waiting". |
| BDG-011 | **Verified (code); live part not checkable** | `0302_ai_credits_plain_sums.sql:28-33` window sums ignore status; `:50-51` settle writes real cost for any status; `:52-54` adds units to `ai_chats` for any status; `turn.ts:133-137` empty/blocked settle as `error` with usage; `turn.ts:150,155` abort paths settle `aborted`; `route.ts:111` substitutes an estimated prompt on an abort with no usage. | Findings say live shows **0 failed rows charged** in 14 days: the 26 failures were provider-unreachable (cost 0). So the charging paths are real but, today, theoretical. The user-visible silence was a model outage already fixed by a model change. Severity of the accounting part is P1 by risk, not by observed harm. |
| BDG-013 | **Verified, but incomplete** | `client/history.ts:5,7,35` keeps 6 items, or 2 when `soft`; `useBuddgyChat.ts:217` passes `softRef`; `0296:126` sets `soft` at `ai_chat_units_soft`; `0298:85` default 30,000 soft / 60,000 hard; `0296:119-122` hard cap closes the chat and rolls; `runTurn.ts:187` reads `rolled` and nothing acts on it. | The analysis stops at the soft cut. It misses that the **normal** path already compacts: after 3 turns everything older becomes a 70-character snip (`history.ts:11`) inside a 1,000-character carry (`:8`). So "short chats never compact" fails even with the soft cut removed. The hard cap is also spend-based (60,000 units, about 8 calls at 7,634 each). The plan's file path `src/lib/buddgy/history.ts` is wrong; the file is `src/lib/buddgy/client/history.ts`. |
| BDG-019 | **Partly** | `billingSession.ts:10` `void startPurchases(userId).catch(() => undefined)` swallows configure failure; `purchases.ts` `loadPackages` returns `[]` while `configuredFor === null`; `usePlanPurchase.ts:16-21` loads once on `active`; `billingStore.ts:53` `isPaidPlan = planKey !== 'free'` so a trial passes `refreshUntilPaid` at once; `ProStateView.tsx:237` the note renders under the Manage bar. | Client defects verified. **Why no package loads** is still a hypothesis (store side unfinished is the leading one). The plan fixes the client and assumes the store will answer; it does not prove the button works. |
| BDG-009/016 (P2) | **Verified** | `QuotaWheel.tsx:31` `navigate('/settings/pro/usage')`; `NoticeHost.tsx:66` "See usage" also navigates. | none |
| BDG-012 (P2) | **Verified** | `buddgyChatCopy.ts:55,64` format the reset with `hhmm` only. | none |
| BDG-014 (P2) | **Verified** | `AIChat.tsx:58` `window.innerHeight`; `@capacitor/keyboard` absent from `package.json`. | Exact iOS jump remains a hypothesis, as stated. |
| BDG-015 (P2) | **Verified** | `navConsent.ts:2-7` one module-level boolean for the whole app run; `navigation.ts:34-37` `start_budget_setup` navigates with no chat close. | none |
| BDG-003 (P2) | **Partly (hypothesis stands)** | `cards.module.css:24` backface rule is on `.slot` (the wrapper); faces carry `mix-blend-mode` layers (`:37,39,41,74,83`); `:28` `.dimmed .slot { filter }`. | Structure matches. A `filter` on the backface-hidden element is a second WebKit flattening trigger the analysis does name. Not provable without Safari. |
| BDG-020 (P2) | **Partly** | `/api/entitlements/me/route.ts:119` already derives `fromStore` from `e.source`; `database.types.ts:5721` `store` column exists. | "/me does not say which store" is true only for the store name; a store/non-store flag exists today. No migration needed, as the plan says. |

## B. Verdict per proposed fix

| Item | Verdict | Reason and required modification |
|---|---|---|
| P-a merge sync, S8a, S-2 | Approved with modifications | Results of jobs 18-21 are unknown and R14 has **no app-code fix** on the sync branch (only a longer test wait, `02` line 51). Do not merge on a green that only waited longer. New migrations must be numbered **0337+** (live has 0331, 0334-0336; main has 0330, 0332, 0333). Fix the label clash: `04` calls the store steps P-c, `05` calls them P-b. |
| P-b store steps | Approved | Correct blocker. |
| P-c QA runner | Approved | |
| **1.1 BDG-011 charging** | **Rejected as written; resubmit in two slices** | (1) **Old clients**: iOS 146 / vc180 talk to the new server and send no `turn_id`. The plan does not say how they are charged. If hops are "provisional, exempt until final", old builds get every hop free forever. Rule required: no `turn_id` = today's per-request rule minus the status exemption. (2) **Sparks are real money** and are charged per hop at `0298:222-224`; the plan never names `ai_quota_settle` or `spark_charge`. (3) "Visible text" cannot be judged from `out_tokens`: text frames stream before usage arrives (`turn.ts:86-89`), and `cancel()` (`turn.ts:153-156`) does not see `sawText`. A user who stops just before the end gets a free answer. Pass `sawText` to settle. (4) "Replay of a finished turn is refused" strands the user in exit 9 (server settled `ok`, client got no `done`): charged, nothing shown, Retry refused. Return the stored answer or allow one free re-run. (5) A `calls` frame can carry visible text; a modified client that never sends the next hop gets it free. (6) The "server timeout closes a turn" job is unspecified (cron? on next reserve?). (7) Adding `p_final` creates a function **overload**; drop the old signature in the same migration and grant `EXECUTE` to `service_role` only (0315). (8) The per-minute `rate` check must keep counting exempt rows, or exemptions become farmable. **Slice 1 (server only, ships now, safe for old builds):** in `ai_quota_settle_core`, write `credits_exempt = true`, add no `ai_chats.units`, and charge no Sparks when status is `error`, or `aborted` with no text seen. **Slice 2:** `turn_id` for hop refunds, with the rules above. |
| **1.2 BDG-013 context** | Approved with modifications | Do the fix **on the server**: stop sending `soft: true` in the meta frame (`route.ts:108`). Installed builds then stop cutting to 2 items with no native build. Do not wait behind 1.1; this is independent and cheap. Raise `VERBATIM_ITEMS` or base it on size, or "short chats never compact" stays false. Lift the hard roll from spend to size, or exclude hop/failed units (1.1 slice 1 does part). The test "a rolled chat still knows a fact from turn 1" cannot pass with a 1,000-char carry of 70-char snips unless the fact is in the last 3 turns; write it against a defined minimum. Expect higher units per turn once history grows; measure before and after on live, which the plan already says. |
| **1.3 BDG-001 theme** | Approved with modifications | Add: set `defaultServerSettings` and `emptySnapshot` to `light` (`sync.ts:69`, `snapshot.ts:80`), or make the pull keep local theme when the server row is absent. Verify the live column default before claiming it is `light` (findings say unknown). `alter type … add value` cannot have the new value used in the same transaction; keep it a lone statement. Consider the findings' simpler option, drop System from the tile (no migration), and put it to the owner. Make the two-device test mandatory, and include an old build (which still uploads `dark` for System) as device B. |
| **1.4 BDG-019 Keep Pro** | Approved with modifications | "Welcome only after a store-sourced row" depends on webhooks that have delivered **0 events in 30 days**, and the reconcile job is deferred to BDG-022. As written, every real buyer sees "Confirming…" forever if a webhook is missed. Add an on-demand server pull from RevenueCat (subscriber lookup) behind the refresh, or move the reconcile out of the deferred block. Use the existing `fromStore` flag from `/me` (`route.ts:119`) rather than a new field. |
| **1.5 BDG-008 SMS state** | Approved with modifications | (1) Keep **claimed** (guide finished or skip confirmed) separate from **run seen** (`lastRunAt`). The plan folds both into "Wired", which the owner ruled out ("a user claim is not proof"). (2) Drop `token != nil` from wired (findings recommend it; the plan is silent). (3) `first_sms_at` is set in the route update at `parse/route.ts:807`, not an "ingest function". (4) Backfill: `min(received_at)` grouped by `(user_id, device_id)`, excluding refusal rows (`status='failed'`, written by `ingestRefusal.ts`) and duplicates, in batches with a short `statement_timeout`, `EXPLAIN` first. (5) Handle phones with no device id (legacy tokens) so they do not regress to "waiting". (6) Fix the new-device precedence on the server (`registry.ts:74`), so old builds benefit. (7) Source the "iOS cannot list Shortcuts" claim from Apple docs, as the owner asked. |
| BDG-009/016 usage sheet | Approved with modifications | Decide "stay sheets or close the chat first" now; the plan leaves it open. The new `usage_view` key must bypass the once-per-session gate. |
| BDG-012 reset line | Approved | |
| BDG-010 mode label | Approved with modifications | Both tiers default to the same model, and the free Advisor answer runs at the same thinking level as Quick (`plan.ts:8`, `gemini.ts:35-36`). A "Thinking" label on it would be false. Define the label from the thinking level actually used, and send it in `meta` (the fallback is chosen before the stream starts). |
| BDG-015 action protocol | Approved with modifications | Covers navigation only. Missing: the owner's "Build my budget here" option, and the audit of data-changing, settings-changing and purchase actions (DT per the register). |
| BDG-014 keyboard | Approved | |
| BDG-017 back | Needs more investigation | Spike `allowsBackForwardNavigationGestures` on WKWebView first ("native where possible"). Restrict any scripted edge swipe to iOS: on Android it collides with the system back gesture. Cover "keeps scroll" and "never leaves the app". |
| BDG-020 manage sheet | Approved with modifications | "Cancelled only after the webhook" has the same webhook gap as 1.4; add the same on-demand pull. PayTabs and Android selling: owner decision, not silently deferred. |
| BDG-026 add pocket | Approved with modifications | The plan builds it into `PocketRadioList` in Phase 2, then replaces the picker in Phase 3 (027/028). Your own graph in `04` says "picker ruling, then 026". Rule on the picker first, or build 026 once on the chosen picker. |
| BDG-003 flip | Approved | One change for four cards. The unit test can only cover the script's face-visibility decision; the iPhone check is the real proof. |
| BDG-002 | Approved with modifications | Counting only the applicable steps changes the calculation: update `useSetupProgress.test.ts`. |
| BDG-023 | Requires owner decision | Target screen. `/settings/data` renders for signed-out users; the biometric toggle needs `user` and `hasPassword`. |
| BDG-004/006 | Requires owner decision | Qualifier on "37 days". Copy otherwise follows the SQL rules; good. |
| BDG-005 | Requires owner decision | The register says Council decides. The plan decides "no expiry" on its own. Fine as a recommendation, not as a decision. |
| BDG-007 | Requires owner decision | Calendar or meter. |
| BDG-018 orb | Rejected as written | "No hint" contradicts the complaint (the move is not discoverable). The register asks Council to choose. RTL mirroring and the remembered position are missing. Drag and snap is CX by the rule: it needs a targeted test, not only a mockup. |
| BDG-021 | Approved | |
| BDG-024 | Requires owner decision | Licensing. "Same icon in transactions" is a new feature (findings G:163) and is not in the plan. |
| BDG-025 card face | Requires owner decision | "One shared component replacing the hand-drawn faces" reshapes existing components, which is against the reuse rule without the owner saying so. Raise the design-system alert. "Stacked where it fits" is missing. |
| BDG-027/028 picker | Requires owner decision | The owner asked for the **provider-style** selector. The plan picks `SelectField`, which `DESIGN_SYSTEM.md:405` says not to use for accounts. This is a contradiction of the brief, not a detail. It is CX, so it needs a targeted test (selector keeps form state). |
| BDG-022 deferred | Approved with modifications | Out-of-order Apple events alone ("latest event wins") can already end a live subscription. Add an event-time guard in `billing_apply` now. Keep the cross-store work behind the gate. |
| Owner approval list | Approved with modifications | `CLAUDE.md` has no plan-approval gate except UI mockups. Policy questions (charging table, wired rule) are fair owner decisions; "approve three migrations" is not a gate the rules require. |

## C. Test tier against the risk rule

| Item | Problem |
|---|---|
| BDG-018 | Drag and snap is CX in the register and in the rule; the plan gives it no test. |
| BDG-027/028 | Selector that keeps form state is CX; the plan treats it as visual. |
| BDG-002 | Calculation changes; the register asks for a unit test; the plan has none. |
| BDG-015 | Data-changing actions are DT in the register; the plan covers only CX navigation. |
| BDG-H2 | P1 and DT, but the plan has no item: it relies on P-a, and R14 has no code fix. |
| BDG-022 | DT, deferred with no test plan beyond "before Google Play". |
| 1.1 | Tests miss: an old client with no `turn_id`; Sparks charged once per turn; Stop after streamed text with no usage; exit 9 Retry. |
| 1.4 / BDG-020 | End-to-end proof is blocked on P-b; label these **Blocked**, not tested. |

No UI-only item was given automated tests it does not need.

## D. Owner expectations missed or contradicted

| ID | Gap |
|---|---|
| BDG-001 | "No flash" and "correct theme on another device" are only partly covered; the dark defaults are untouched. |
| BDG-008 | "Claimed" is not a separate state; the Apple-docs citation is missing. |
| BDG-011 | No alert on a per-model error spike (the real cause of the silence). Testers' lost usage is listed as a question only. |
| BDG-013 | "Short chats never compact" is not met (3-turn verbatim window). The Council on compaction did not happen. |
| BDG-015 | "Build my budget here", and the audit of all actions. |
| BDG-017 | "Keeps scroll" and "never leaves the app". |
| BDG-018 | Hint (contradicted), RTL, remembered position. |
| BDG-020 | PayTabs cancel (not in code; needs the owner's ruling, not a silent deferral). |
| BDG-022 | Deferred in full. |
| BDG-024 | Same icon in transactions. |
| BDG-025 | "Stacked" look; the plan turns a visual ask into a refactor. |
| BDG-027 | Provider-style selector (contradicted by `SelectField`). |

## E. Top five risks of executing as written

1. **Buddgy charging rewrite meets installed builds.** The server changes at once and native builds arrive last. With no rule for requests without `turn_id`, and Sparks not named, you get free hops for old builds or double Sparks for new ones, plus function overloads on the live DB.
2. **Building on an unmerged, still-red sync base.** Live is ahead of main, jobs 18-21 are unseen, R14 has no app fix, and migration numbers can collide with 0331-0336. BDG-001 and any settings work sit on top of it.
3. **Billing "verified only" with no verification channel.** Zero webhook events in 30 days, and the reconcile is deferred. Real buyers can be stuck on "Confirming…" and cancels never show. Sandbox purchases grant live Pro (B-1).
4. **Context fix done client-side only.** If 1.2 lands in client code, installed builds keep losing memory until a rebuild. Keeping more history also raises units per turn on a 6-credit Free session, so more users hit BDG-012 limits.
5. **SMS state shown as fact that the system cannot prove.** The plan folds claim into "wired". The per-device pill regresses legacy-token phones. A backfill runs on a growing live table. Everything is verifiable only on a device.

## F. Lead's response (2026-11-20)

The audit was written without sight of the Council record, by design. `05-fix-plan.md` is now revision 2.

| Audit point | Outcome |
|---|---|
| 1.1 rejected as written; split in two; old builds, Sparks, "text sent", cut-stream Retry, overloads, rate check | **Accepted in full.** Slice 1 is server only and ships first. |
| 1.2 fix on the server, do not wait for 1.1, raise the verbatim window, wrong path | **Accepted.** |
| 1.3 dark client defaults; mandatory two-device test with an old build | **Accepted.** The live column default was checked by the lead: `light`; live enum: `dark, light`. |
| 1.4 and 020 on-demand pull from RevenueCat; use `fromStore` | **Accepted.** |
| 1.5 keep "claimed" apart from "run seen"; drop the token; route not function; backfill rules; legacy tokens; server precedence | **Accepted.** Which fact shows the switch stays an owner decision. |
| 1.5 cite Apple for "cannot list Shortcuts" | **Cannot be met.** Apple pages were fetched; none states the negative. Kept as "unsourced". |
| 010 label from the thinking level used | **Accepted.** |
| 015 add data-changing actions and "Build my budget here" | **Accepted** for the audit of write tools. "Build it here" stays an owner decision: three Council voices advised against it until a chat path exists. |
| 017 spike the native swipe first; scripted swipe iOS only | **Accepted.** |
| 018 rejected: "no hint" contradicts the complaint | **Partly accepted.** RTL, remembered side and a targeted test added. The hint is put to the owner: the Council (three voices) dropped it because an orb that follows the finger sideways already shows it can cross. |
| 026 settle the picker first | **Accepted.** |
| 025, 027/028 design-system alerts and owner decisions | **Accepted.** |
| 002 unit test | **Accepted.** |
| 022 add an event-time guard now | **Already present.** `billing_apply` (migration 0306, lines 201 to 204) marks an older event `stale` and returns. |
| "Approve three migrations is not a gate the rules require" | **Not accepted.** The owner's brief for this program asks for approval before migrations and deployments. |
| BDG-013 "the Council on compaction did not happen" | It did (decision D2 in `06-council-review.md`); the auditor was told not to read it. |
| Label clash P-b / P-c between `04` and `05` | Fixed: `05` is the reference (P-a merges, P-b store steps, P-c runner). |
| No alert on a per-model error spike | **Accepted**, added to 1.1 slice 1. |
| BDG-H2 has no item; R14 has no code fix | **Accepted** as a warning in P-a. The fix stays with the sync session. |
