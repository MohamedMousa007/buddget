# C1: Buddgy usage, limits and accounting (BDG-009, 010, 011, 012, 016)

Investigator C1. Read-only. Code read at this worktree's HEAD (`3d65b36f`); `git merge-base --is-ancestor origin/main HEAD` holds. `git log 75e4ce8c..HEAD` over the Buddgy, AI, usage and migration paths is empty, so the store builds (iOS 146 / Android vc180, `75e4ce8c`) run the same code: **every symptom below exists at `origin/main` and in the store builds.** For every `--no-merged` remote branch I ran `git diff --name-only origin/main...origin/<b>` over `src/app/api/buddgy`, `src/lib/server/ai`, `src/lib/buddgy`, `src/hooks/useBuddgyChat.ts`, `src/components/features/ai-chat`, `src/components/features/usage` and `src/lib/usage`. Only `claude/s2-pocket-networth-design-7eb078` touches one file (`src/lib/buddgy/tools/exec/savings.ts`), and that file is unrelated. `wizardly-elion`, `inspiring-boyd` and `ios/one-automation-sms` exist but are already merged; `practical-khayyam` is not on the remote. The defining commits are `ab0fe6c5` (credits), `767f39ba` (chat rework) and `cf71a756` (notice system). Later ones (`5240cfca`, `5f9b4e7f`) only touched copy and quick add.

## How one chat turn is charged today (the map every issue below uses)

One user message is one *turn*. A turn is **1 to 4 HTTP requests**: the first request plus up to 2 (Free) or 3 (Pro) tool hops. Each request is reserved and settled on its own.

| Step | Where | What happens to money |
|---|---|---|
| 1. Send | `src/hooks/useBuddgyChat.ts:170-235`: `busyRef` blocks a second send (`:173`), `runTurn(...)` | none |
| 2. Request loop | `src/lib/buddgy/client/runTurn.ts:155-228`: one POST `/api/buddgy/turn` per hop, `hop: true` after the first (`:158`) | none client-side |
| 3. Pick tier | `src/app/api/buddgy/turn/route.ts:50-53` | none |
| 4. Reserve | `route.ts:64-71` -> `reserveAiQuota` (`src/lib/server/ai/quota.ts:81-144`) -> SQL `ai_quota_reserve_v2` (`supabase/migrations/0298_credit_windows_and_plan_limits.sql:145-189`) -> `ai_quota_reserve_v2_core` (`0296_s6_sms_off_per_minute.sql:8-`) | **No charge.** It checks the credit windows (session/week) against **settled** `ai_usage_events` only (`0298:159-163`, in-flight reservations are not counted). It inserts an `ai_reservations` row (`0296` core, the `insert into public.ai_reservations` at the end) and starts the 5 h session (`0298:182-186`) |
| 5. Model call | `route.ts:93-96` -> `callGeminiResilient` (`src/lib/server/ai/gemini.ts:96-129`): primary twice, then the other tier's model | none |
| 6. Stream | `src/lib/server/ai/buddgy/turn.ts:47-158` re-emits SSE as `meta/text/calls/done/error` | none |
| 7. Settle | `route.ts:109-114` / `route.ts:75-76` -> `settleAiQuota` (`quota.ts:159-180`) -> `ai_quota_settle` (`0298:212-230`) -> `ai_quota_settle_core` (`0302_ai_credits_plain_sums.sql:40-58`) | **The charge happens here.** It inserts an `ai_usage_events` row with `cost_usd_micro` from the real tokens, **whatever the status** (`0302:50-51`). It adds the units to `ai_chats.units`, whatever the status (`0302:52-54`). On the Sparks path it calls `spark_charge` when the status is `ok`, or `aborted` with output > 0 (`0298:222-224`) |
| 8. Count | `ai_credit_windows` (`0302:12-38`) sums `cost_usd_micro` over `ai_usage_events where feature <> 'sms' and not credits_exempt`, **with no status filter** (`0302:28-33`) | every settled row with tokens counts toward session and week |

Units: 1 credit = 1 Spark = $0.001 (`0298:4`). Free = 6 credits per 5 h session, 15 per week (`0298:93`). Pro/trial = 50 / 150 (`0298:96-103`). The model price is $0.30/M input, $0.03/M cached, $2.50/M output (`0303_gemini_35_flash_lite_price.sql:4`). Every request resends the static system prompt plus **all** tool declarations (`route.ts:80-85`), so on Free a handful of requests can fill a session. How large each request really is (tokens, cache hit rate) is not measurable here; see "Queries for the lead".

**A second limiter, always on.** Besides credits, `ai_quota_reserve_v2_core` enforces rolling **unit** windows that `ai_effective_limits` (latest: `0306_pro_rewards_sparks.sql`, not gated by `billing_enabled()`) reads from the plan row. For Free they are 40 000 units / 5 h, 60 000 / 24 h, 200 000 / 7 d and 10 requests a minute (`0290_s6_limits_and_sms_quota.sql:63`). Pro is at `0290:72`, trial at `0290:77`. They sum `units` of **every** settled row, whatever its status or `credits_exempt`, plus the `est_units` of in-flight reservations (`0296` core, the `window_*` loop). Their denials (`window_5h/24h/7d`, `rate`, `chats_*`) are not a "limit layer" for the UI (`onLimitDenied.ts:5-7`): no sheet, and the billing-on ring shows credits only (`QuotaWheel.tsx:23`). So with billing **off** a Free user can still be blocked by failed requests through this limiter, with the chat saying "I've talked your ear off" and a ring that looks fine. Pro in Egypt gets 100 credits a week instead of 150 (`0306:19,93`).

Phase B (`0301_db_load_phase_b.sql`) added the `ai_credit_counters` running totals. They kept the same status-agnostic rule (`0301:104-111,136-139,148-162`). `0302` dropped them and restored the plain sums verbatim (`0302:1-6,60-62`). **Phase B did not change when a request is charged**, and it is not live in the code. Whether `ai_credit_counters` still exists on the live DB is a query for the lead.

---

## BDG-011

| Field | Content |
|---|---|
| Issue ID | BDG-011 |
| Summary | A request is charged at settle by its real token cost whatever its outcome, and each tool hop is charged separately. Empty replies, safety blocks, stalls, cut streams, client aborts, a failing last hop and a denied hop all cost credits (and Sparks) while the user gets no answer, and some of these show nothing at all. |
| Severity | P1 (money/trust: on Free, a few failed turns can use up the 6-credit session) |
| Reproducibility | Consistent by code for each path below. Steps for the cleanest one: on Free, ask something the model answers with an empty reply or a safety block. The bubble shows "Couldn't finish that", and `ai_usage_events` gains a `status='error'` row with `cost_usd_micro > 0`. Tap Try again and a second charged row is added. |
| Platform | all |
| Affected components | `src/app/api/buddgy/turn/route.ts:64-118`; `src/lib/server/ai/buddgy/turn.ts:131-156`; `src/lib/server/ai/quota.ts:159-189`; `src/lib/buddgy/client/runTurn.ts:154-235`; `src/hooks/useBuddgyChat.ts:212-274`; `src/components/features/ai-chat/AIChatMessageList.tsx:59-100` |
| Backend dependencies | `/api/buddgy/turn`; SQL `ai_quota_reserve_v2`, `ai_quota_reserve_v2_core`, `ai_quota_settle`, `ai_quota_settle_core`, `ai_credit_windows`, `spark_charge` (`0291_s6_sparks_ledger.sql`), `spark_available`, `ai_quota_release` (`0128`, never called by chat); tables `ai_reservations`, `ai_usage_events`, `ai_chats`, `ai_credit_sessions`, `ai_credit_resets`, `spark_allowances`, `spark_purchases`, `spark_spend`, `advisor_free_uses` |
| Root cause | Confirmed. (1) Charging is status-blind: `ai_credit_windows` sums every settled row (`0302:28-33`), and settle writes the real cost for `error` and `aborted` too (`turn.ts:135,150,155`). (2) The unit of charge is the HTTP request, not the user turn. A request that ends in `calls` settles as `ok` (`turn.ts:131-140`), so it is charged in credits and at least 1 Spark (`0298:222-223`) before the answer exists. (3) There is no turn id or idempotency key, so every Retry is a fresh reservation. (4) Aborts are charged an estimated prompt (`route.ts:111`). |
| Evidence | See "Exit paths" below. |
| Shared causes | BDG-013 (the same settle adds failed and hop units to `ai_chats.units`, which drives the "getting long" prompt), BDG-012 (hop and rate denials are shown as a spent limit), BDG-015 (nav-only tool turns end silently) |
| Proposed solution | See "Reserve / settle / refund design". |
| Regression risk | Under-charging if "refund" is too broad (provider cost is still real: keep logging it, just mark it exempt). A turn id must not let a client re-run a turn for free (bind it to the user and a short TTL; only the *final* outcome decides). `ai_chats.turns` and the hop cap `(turns+1)*3` (`0296` core, hop branch) must follow the same rule or hops get refused. |
| Test that proves it | Integration test in the style of `src/app/api/buddgy/turn/route.test.ts` (it mocks `settleAiQuota`), plus a SQL test on a branch DB: settle one `status='error'` row with `p_in=8000` and assert `ai_credit_windows(...).session_used` is unchanged. It fails today (it rises by about 2.4) and passes once error rows are exempt. Client: a `runTurn.test.ts` case where hop 1 returns `calls` and hop 2 returns 502; assert the final-outcome call carries the turn id with `status='failed'`. Playwright: add `e2e/journeys/specs/g-buddgy.spec.ts` `test.fail('BDG-011 empty reply is not charged')`, which reads `/api/entitlements/me` usage before and after a stubbed empty reply (needs `GEMINI_API_BASE` pointed at a stand-in, as `docs/buddgy/INTERNAL_GUIDE.md:184` describes). |
| Confidence | high (charging rules); medium (how often each path happens in production) |
| Missing evidence | Production rates per status; whether usageMetadata arrives on early SSE chunks (this decides how much a stall or abort costs); whether `billing_enabled()` is true live (if false, credits do not block anyone yet, but rows are still written with cost). |

### Exit paths: what each one does to the counter today

"Charged" = an `ai_usage_events` row with `cost_usd_micro > 0` and `credits_exempt = false`, which counts in session and week. Sparks are charged only if the reservation had `use_sparks` (the user was over the limit with Sparks left).

| # | Exit | Code | Status settled | Credits | Sparks | `ai_chats.units` / turns | What the user sees |
|---|---|---|---|---|---|---|---|
| 1 | Normal text answer | `turn.ts:139-140` | ok | yes | yes (>=1) | +units, +1 turn | answer |
| 2 | Model asks for tools (a hop follows) | `turn.ts:131-132,139-140` | ok | **yes** | **yes, >=1 per hop** | +units, +1 turn (feature `chat`) / +0 (feature `chat_hop`) | nothing yet |
| 3 | Gemini unreachable / non-OK after retries | `route.ts:97-104` (`settleFailed`, zero usage) | error | no (cost 0) | no | +0; an event row still counts toward the per-minute rate (`0296` core) | "Couldn't finish that. Try again." |
| 4 | Empty reply (no text, no calls) | `turn.ts:133-137` | error | **yes, real prompt cost** | no | +units | "Couldn't finish that." |
| 5 | Safety block / refusal with no text | `turn.ts:134` (`blocked`) | error | **yes** | no | +units | "I can't help with that one..." |
| 6 | Upstream stalls 25 s or the stream breaks | `turn.ts:105-110,142-150` | aborted | **yes; the estimated prompt if no usage yet** (`route.ts:111`) | only if output > 0 | +units | "Couldn't finish that." (`runTurn.ts:200-201` `upstream` -> `failed`) |
| 7 | User taps Stop / closes the connection (hypothesis: this assumes the host passes the client disconnect into the stream's `cancel()`; if it does not, the stream runs on and settles `ok` at full cost) | `turn.ts:153-156` (`cancel`) | aborted | **yes; the estimated prompt if no usage yet** | if output > 0 | +units | bubble set to `done` with whatever streamed (`useBuddgyChat.ts:246-247`); if nothing streamed: **nothing at all** (`AIChatMessageList.tsx:62-71` draws no bubble for empty text; `copy.stopped` exists but is never used) |
| 8 | Client 30 s idle timeout | `src/lib/buddgy/client/sse.ts:4,33-37`; `runTurn.ts:205` | server sees a cancel -> aborted | **yes** | maybe | +units | "Couldn't finish that." |
| 9 | Stream ends with no `done` and no `calls` (cut) | `runTurn.ts:208-209` | whatever the server settled (often ok) | **yes** | **yes if ok** | +units | "Couldn't finish that." The server may have finished; a Retry charges again |
| 10 | Last allowed hop still asks for data | `runTurn.ts:217-220` | every earlier hop settled ok | **yes, every hop** | **yes, every hop** | +units | "Couldn't finish that." |
| 11 | Hop refused with `layer 'rate'`. The realistic trigger is the Free per-minute cap of 10 (`0290:63`), because one turn is 1-3 requests on Free. The hop cap `(turns+1)*3` and the 10-minute rule are hard to reach, since the first request's `ok` settle bumps `turns` before any hop reserves (`turn.ts:140` awaits settle before close) | `0296` core (rate check, hop branch); `runTurn.ts:177,61-68` | earlier hops ok | **yes, earlier hops** | yes | +units | quota line "I've talked your ear off for now..." (`src/lib/i18n/buddgyChatCopy.ts:53-59`: `rate` falls through to the limit text), **no Retry button** (`AIChatMessageList.tsx:94`) |
| 12 | Hop body grows past 24 000 chars or 16 messages | `src/lib/server/ai/buddgy/validate.ts:42,86` -> 400 | earlier hops ok | **yes, earlier hops** | yes | +units | "Couldn't finish that." |
| 13 | Tool throws on the device | `runTurn.ts:129-132` -> `tool_failed` sent back as a hop | each hop ok | yes per hop | yes per hop | +units | the model usually explains; or exit 10 |
| 14 | Nav-only tool call, no text | `runTurn.ts:115-118,216` (break) | ok | **yes** | yes | +units | **nothing**: an empty `done` bubble is not drawn (`AIChatMessageList.tsx:62`); the app navigated behind the chat (BDG-015) |
| 15 | Later hop fails after an earlier proposal | `runTurn.ts:229-233` | ok | yes | yes | +units | proposals kept, marked truncated (fair) |
| 16 | Serverless function killed (`maxDuration = 60`, `route.ts:19`) before settle | - | **never settled** | no (an unsettled reservation is not counted in credits) | no | unchanged | "Couldn't finish that." (provider cost untracked) |
| 17 | Reserve RPC fails twice | `quota.ts:119-127` | - | no | no | - | "Buddgy is resting for a moment." |
| 18 | Free Advisor answer that fails | `0298:226-228` | error | `credits_exempt` row (not counted) | - | +units | the free answer is not used up (the one path that already does it right) |

**When a request is charged today:** at settle, by real token cost, for every request whose provider call returned anything (statuses `ok`, `error` with usage, `aborted`). The only free exits are 3, 16, 17 and 18.

**User pays and gets nothing:** 4, 5, 6, 7 (when nothing streamed), 8, 9, 10, 11, 12, 14. **Silent (no message at all):** 7 with no text, and 14. **Misleading message:** 11, shown as a spent limit with no retry.

**Idempotency:** none. `TurnRequest` has no id (`src/lib/buddgy/protocol.ts:24-36`). `retry()` removes the failed exchange and calls `send(lastUser.text)` (`useBuddgyChat.ts:267-274`), which is a new reservation and a new charge. `apiFetchAuth` does not replay (`src/lib/apiBase.ts:98-101`), so double charges come only from the user's Retry and from exit 9.

**Concurrency:** one device cannot overlap turns (`busyRef`, `useBuddgyChat.ts:51-52,173`). Two devices or tabs can. The reserve takes a per-user advisory lock (`0298:155`), but the credit check reads only settled events (`0298:159-163`), so two concurrent requests both pass at 5.9/6. That over-grants; it never over-charges. A request admitted under the limit is not charged in Sparks even if it crosses the limit (`0298:221` comment). Hops pass a spent limit on purpose (`0298:172`).

### Reserve / settle / refund design (smallest reliable change on the existing tables)

The current rows can carry the policy as they are: `ai_reservations` (one per request), `ai_usage_events.credits_exempt` (already excludes a row from every credit sum, `0302:29,33`), and `spark_charge` (already conditional at settle). The plan:

1. **Ids.** The client creates `turnId = crypto.randomUUID()` per user message (in `send`, `useBuddgyChat.ts:185`) and an `attempt` counter (1, then +1 on each Retry). Both go on every hop (`runTurn.ts:156-164`). The server validates them (`validate.ts`). Migration: `ai_reservations.turn_id uuid, attempt smallint` and the same on `ai_usage_events`, with a partial index `(user_id, turn_id) where turn_id is not null`. Each new function gets `EXECUTE` for `service_role` only (rule 0315).
2. **Provisional settle.** Every request still settles with its real tokens, so the cost stays observable. A request is written `credits_exempt = true` and charges no Spark when (a) it ended `error`, (b) it ended `aborted` with `out_tokens = 0`, or (c) it ended in `calls` that include a read tool (`ToolKind` 'read', `src/lib/buddgy/tools/spec.ts:3,35`; a hop must follow). Final and charged: `aborted` with `out_tokens > 0` (the user saw text), `ok` with text, and `calls` with only write/nav tools (the client stops there, `runTurn.ts:216`). This needs a new `p_final boolean` on `ai_quota_settle`.
3. **Final outcome = the charge (server-only).** In the settle of a final, charged request, one set-based `UPDATE ai_usage_events set credits_exempt = false where user_id = $1 and turn_id = $2 and attempt = $3 and credits_exempt and status = 'ok'` re-counts that attempt's provisional hops. Then one `spark_charge` for the attempt's sum if it used Sparks. Failed attempts' rows stay exempt, so a successful Retry does not pay for the failed attempt. Needs no client call.
4. **Idempotency and replay bound.** A reserve with a `turn_id` whose final row already exists (any attempt) is refused as `duplicate` (409, the client keeps the answer it has). This stops free replays under one id. Cap attempts per `turn_id` (e.g. 3) in the reserve, and keep the per-minute `rate` check counting every request, exempt or not, so exempt failures cannot be farmed.
5. **The unit windows and chat size follow the same rule.** The rolling `window_*` sums (`0296` core) and `ai_chats.units` (`0302:52-54`) must skip exempt rows: add a `not credits_exempt` filter, or write units only on final. Otherwise failures still block through the second limiter and push the chat toward "too long" (BDG-013). `ai_chats.turns` already counts only `chat`+`ok`.
6. **Client.** Exit 7 shows `copy.stopped`. Exit 14 shows a one-line "Opened X" note (BDG-015). Exit 11 shows a retryable "busy, try again" line, not the limit text.

Policy per failure type (proposal for the owner):

| Failure | Credits | Sparks |
|---|---|---|
| provider error / unreachable / 5xx | free | free |
| empty output | free | free |
| safety block / refusal (no text) | free (the user cannot get the answer by retrying) | free |
| timeout / stall / stream cut with no text | free | free |
| stream cut after partial text | charge what streamed (the current aborted rule) | charge if output > 0 |
| user Stop with no text | free | free |
| user Stop after text | charge | charge |
| tool failure the model recovers from | charge the turn once, when it is answered | once |
| last hop never answers / hop refused / hop 400 | free (every hop in the turn) | free |
| duplicate Retry of an answered turn | no second charge | no second charge |

---

## BDG-010

| Field | Content |
|---|---|
| Issue ID | BDG-010 |
| Summary | There is no user-visible mode and no user switch. The tier is picked by an on-device regex; both tiers default to the same model id; the server tells the client only the configured tier (not the model that answered), and the client throws even that away. |
| Severity | P2 |
| Reproducibility | consistent |
| Platform | all |
| Affected components | `src/lib/buddgy/local/classifyIntent.ts:4-37`; `src/hooks/useBuddgyChat.ts:225`; `src/app/api/buddgy/turn/route.ts:50-53,93-96,108`; `src/lib/server/ai/buddgy/prompt.ts:34-38`; `src/lib/server/ai/buddgy/plan.ts:8,22-27`; `src/lib/server/ai/gemini.ts:9-14,31-37,96-129`; `src/lib/buddgy/client/runTurn.ts:184-190` |
| Backend dependencies | `advisor_gate` (`0298:240-260`), `advisor_free_uses` |
| Root cause | Confirmed. (1) The choice is `classifyIntent(text)` on the device (`useBuddgyChat.ts:225`): `advice` if the ADVICE regex matches (`classifyIntent.ts:4-12,29`), else `action`/`answer`. (2) The server maps the intent to a tier: `advice` = `smart` with 1200 output tokens and thinking budget 1024; the others = `fast`, no thinking (`prompt.ts:34-38`). A non-Pro user without a free Advisor answer is downgraded to `answer` (`plan.ts:26`). The free Advisor answer caps thinking at 512 (`route.ts:52`, `plan.ts:8`). (3) `TIER_MODELS.fast` and `.smart` **both default to `gemini-3.5-flash-lite`** (`gemini.ts:11,13`). Unless production sets `GEMINI_MODEL_SMART`, "Thinking" is the same model with a higher thinking level. (4) For 3.x models a budget <= 512 maps to `thinkingLevel: 'minimal'` (`gemini.ts:35-36`), so **the free Advisor answer runs with the same thinking level as Quick**; only its output cap and context (3000 chars, `plan.ts:4`) differ. (5) On failure `callGeminiResilient` falls back to the other tier's model (`route.ts:93-94`), and `usedModel` is used only for settle (`route.ts:96,112`). The `meta` frame sends `tier: cfg.tier` (`route.ts:108`), the configured tier, not the one that answered. (6) The client reads `meta` but ignores `tier` (`runTurn.ts:184-190`). The only mode hint shown is the `advisor` note for free/locked (`AIChatMessageList.tsx:109-111`). (7) The `advisor_pick` usage event is defined (`src/lib/usage/usageNotices.ts:51,118`) but never pushed anywhere, so no picker exists. |
| Evidence | as above |
| Shared causes | BDG-015 (the ADVICE regex sends "set up a budget" to the Advisor tier, `classifyIntent.ts:7`) |
| Proposed solution | A truthful label needs the server to report what actually ran. Add to the final `done` frame (not `meta`, which is sent before any fallback is known): `{ model: usedModel, tier: <tier of usedModel>, thinking: <level actually sent> }` (`turn.ts:139`, `route.ts:106-115`). Derive the tier from `usedModel` by reverse lookup in `TIER_MODELS`. When both tiers resolve to the same id, report the thinking level as the honest difference. The client stores it on `BuddgyItem` (`chatTypes.ts:43-58`) and shows a small label next to the existing advisor note (`AIChatMessageList.tsx:109-111`). If the owner wants a user switch, it is the `intent` field already in the protocol (`protocol.ts:35`), and `advisor_pick` already has its notice row. Fix (4) by sending `medium` for the free Advisor answer, or by labelling it honestly. |
| Regression risk | The label changes no behaviour. A switch changes cost per message (the smart tier has a 2x output cap plus thinking billed as output, `prompt.ts:30-31`). |
| Test that proves it | Unit test on `turnEventStream`/route: a fallback to the other model yields `done.model === <fallback id>`. It fails today (no field). |
| Confidence | high |
| Missing evidence | The production values of `GEMINI_MODEL_FAST` / `GEMINI_MODEL_SMART` on Vercel (`docs/ENV.md:12`). |

---

## BDG-012

| Field | Content |
|---|---|
| Issue ID | BDG-012 |
| Summary | The server returns an exact `resetAt` (and `Retry-After`), but the chat line shows only a clock time with no day or timezone, even for a week reset days away. The full limit sheet appears once per app session. Its meter replaces the reset with "Limit reached" at 100%. Rate/hop/window denials are worded as a spent limit. |
| Severity | P2 |
| Reproducibility | consistent once billing is on and a Free user passes 15 credits in a week |
| Platform | all |
| Affected components | `src/lib/server/ai/quota.ts:191-203`; `src/lib/i18n/buddgyChatCopy.ts:50-69,98-104`; `src/lib/ai/quotaDeniedCopy.ts:25-38`; `src/lib/usage/onLimitDenied.ts:5-21`; `src/lib/usage/usageNotices.ts:76-103`; `src/components/features/usage/NoticeHost.tsx:160-252,289-301`; `src/lib/i18n/usageCopy.ts:53-61`; `src/lib/usage/format.ts:5-27`; `src/components/features/ai-chat/AIChatMessageList.tsx:90-100` |
| Backend dependencies | `ai_quota_reserve_v2` (`0298:164-171`), `ai_credit_windows` (`0302:12-38`), `ai_usage_state` (`0298:476-502`), `ai_quota_status` (`0132`) for the legacy wheel |
| Root cause | Confirmed. **Limits** (`0298:82-103`, `0290:63-77`): Free = 6 credits per session, 15 per week, `ai_req_per_min` 10, rolling unit windows 5 h/24 h/7 d, `ai_chats_per_hour`/`_per_day`, chat soft/hard 30 000/60 000 units and 40 turns. Pro and trial = 50/150. Sparks = an add-on wallet used only once a window is spent (`0298:164-167`); no plan grants a monthly Sparks allowance in these migrations (`sparks_per_month 0`, `0298:93-101`); reward and trial allowances from `0306` were not fully read. **Reset moment:** the session is a 5-hour window from the first credit request after the previous one ended (`0298:114,182-186`; `0302:25-26,35`). The week starts at the user's `week_start_day` at midnight **in `user_settings.timezone`**, UTC if unset (`0302:19-24`). The windows `window_5h/24h/7d`, `chats_*` and `rate` are rolling: their `reset_at` is "oldest event + span" (`0296` core), which is not necessarily when the user is back under the limit. **The API returns it:** a 429 body `{layer, resetAt}` plus `Retry-After` (`quota.ts:192-202`); `ai_usage_state` returns `session.resetAt` / `week.resetAt` (`0298:487-490`). **What the user sees:** the chat bubble uses `quotaEn` (`buddgyChatCopy.ts:53-59`): "I've talked your ear off for now. I'll be back around {hh:mm}", where `hhmm` is a time only (`:49-50`), with no weekday, no date and no timezone. For `week` this can say "around 00:00" when the reset is Saturday. `rate` (also the hop cap) falls through to the same limit text. No Retry button is shown for any quota kind (`AIChatMessageList.tsx:94`). `onLimitDenied` queues the sheet only for `session`/`week`/`sparks` (`onLimitDenied.ts:5-7,15`). The sheet is `oncePerSession` for blocked notices (`usageNotices.ts:76-78`, `NoticeHost.tsx:297`), so a second hit in the same app session shows only the bubble. Sheet copy per plan (`limitEvent`, `usageNotices.ts:92-103`; copy `usageCopy.ts:53-61`): Free `session_block` "Buddgy can answer again at {HH:mm}", `week_block` "...on {weekday}" with no time; Pro `pro_week` "Pro's weekly limit resets on {weekday}"; trial `trial_block`; Sparks left -> a toast "Using your Sparks until {time}" (`usageNotices.ts:93`). Offers: Free gets Sparks + Pro, Pro/trial get Sparks only (`usageNotices.ts:87`). This already matches "no upgrade button for Pro". In the sheet the meter note switches to `copy.meter.reached` at >= 100% (`NoticeHost.tsx:215,218`), so the blocking window shows no reset. Only the title body carries it. |
| Evidence | as above |
| Shared causes | BDG-011 exit 11 (the hop cap shown as a limit); BDG-009 (the sheet's Go Pro navigates behind the chat, `NoticeHost.tsx:245`) |
| Proposed solution | (1) One formatter for a reset: weekday + date + time, and the timezone name when `user_settings.timezone` differs from the device (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Reuse `weekdayDate` + `clock` from `src/lib/usage/format.ts`; use it in `quotaEn`/`quotaAr` and in the `week_block`/`pro_week` bodies. (2) `rate` gets its own line ("Too many at once, try again in a minute") and keeps the Retry button. (3) Meter note at 100%: "Limit reached · resets {when}". (4) Show the existing `LimitSheet` every time a turn is blocked in chat (drop `oncePerSession` for the chat screen, or offer the sheet from a button on the bubble). The chat stays mounted because the sheet is `ModalShell` at `z-[100]` above the chat's `z-50` (`src/components/modals/ModalShell.tsx:14`, `AIChat.tsx:121,141`). (5) Sparks-eligible: the existing `session_sparks` toast. Free: `offers: ['sparks','pro']`. Pro: `['sparks']`. Already right. |
| Regression risk | Copy only, plus one rules-table flag; the `usageNotices.test.ts` expectations change. |
| Test that proves it | `src/lib/i18n/buddgyChatCopy.test.ts`: `copy.error({kind:'quota', layer:'week', resetAt:<a Saturday>})` contains the weekday. It fails today. `usageNotices.test.ts`: a second `limit` event in the chat screen still yields a sheet. |
| Confidence | high |
| Missing evidence | Whether billing is on live. If it is off, the credit limits never block, but the always-on unit windows (`window_5h/24h/7d`, `rate`, `chats_*`) still do. Those show only the generic "talked your ear off" line, with a rolling `reset_at` and no sheet. The live `plans.limits` rows (they may differ from the migrations). Who is "Sparks-eligible" = `spark_available(...) >= 1` (`0298:165`): allowances (trial, plan periods, reward grants in `0306`) plus purchases. `0306`'s grant rules were not read in full. |

---

## BDG-009 and BDG-016

| Field | Content |
|---|---|
| Issue ID | BDG-009 (and BDG-016) |
| Summary | The usage ring (it sits in the composer beside Send, not in the header) calls `navigate('/settings/pro/usage')` while billing is on. That is a shell-route History push, so the Usage page renders in the app shell **under** the chat overlay, which stays open at `z-50`. |
| Severity | P2 |
| Reproducibility | consistent (billing on): open Buddgy, tap the ring. The page changes behind the dimmed backdrop; the chat stays on top. |
| Platform | all (web, iOS, Android) |
| Affected components | `src/components/features/ai-chat/QuotaWheel.tsx:21-36`; `src/components/features/ai-chat/AIChatComposer.tsx:44`; `src/components/features/ai-chat/AIChat.tsx:113-185`; `src/components/modals/ModalProvider.tsx:96`; `src/lib/navigation/navigate.ts:28-42`; `src/lib/navigation/shellRoutes.ts:35` |
| Backend dependencies | none new: `/api/entitlements/me` -> `ai_usage_state` (already in `useBillingStore`) |
| Root cause | Confirmed. `UsageWheel` `onClick={() => navigate('/settings/pro/usage')}` (`QuotaWheel.tsx:31`). `/settings/pro/usage` is a shell path (`shellRoutes.ts:35`), so `navigate` does `history.pushState` + `setNavPath` (`navigate.ts:32-37`) and swaps the in-memory view. The chat is not a route: it is a fixed overlay mounted once in `ModalProvider` (`ModalProvider.tsx:96`) and opened by `activeModal === 'aiChat'` (`useBuddgyChat.ts:38`). Nothing closes it on a path change; a pushState fires no popstate, and `useDismissable` only guards back/Escape (`useDismissable.ts:32-42`). So the page lands behind the chat at `z-50` (`AIChat.tsx:121,141`). The chat itself is **not** remounted and keeps its draft and stream (state lives in `useBuddgyChat` inside the always-mounted `AIChat`). Requirement 016 is met today except for the "no background navigation" rule. The legacy ring (billing off) opens a popover in place (`QuotaWheel.tsx:38-80`) and is fine. The same "navigates behind the chat" pattern exists in: the `session80`/`week80` banner "See usage" in the chat (`NoticeHost.tsx:66` via `NoticeBanners screen="chat"`, `AIChat.tsx:171`), the `LimitSheet` "Go Pro" button (`NoticeHost.tsx:245`, `onClose(); navigate('/settings/pro')`), `plans_ro`/`trial.*`/`expired` actions if shown in chat, and Buddgy nav tools (BDG-015). |
| Evidence | as above |
| Shared causes | BDG-015 (navigation from inside the chat), BDG-012 (the same sheet) |
| Proposed solution | Reuse, no new component: open the existing `LimitSheet` presenter (`NoticeHost.tsx:161-252`: `ModalShell` at `z-[100]` + `V3SheetHeader` + `UsageMeter` + `SparksPackPicker`) through `useUsageStore` (`src/lib/usage/usageStore.ts`, `setSheet`/`setPacksOpen`), as an **additive** notice key, e.g. `usage_view`, `severity 'info'`, `surface 'sheet'`, offers from `limitOffers(s)` (`usageNotices.ts:87`). Its body shows both meters with the reset line (BDG-012 formatter), plan, Sparks left, and buttons: Get Sparks (switches the same sheet to its packs view, already built, `NoticeHost.tsx:181-203`); Free only: See Pro; and a secondary "Full usage page" that closes the chat first (`setActiveModal(null)` then `navigate`). Wheel: `onClick={() => useUsageStore.getState().setSheet(usageViewNotice)}`. The `NoticeHost` renders only when billing is on (`BillingHost.tsx:66`), the same condition as `UsageWheel`. For in-chat "Go Pro" / "See usage" actions, close the chat before navigating, or keep them as sheets. One sheet at a time is already enforced (`NoticeHost.tsx:291,295`); repeatable, since an `info` notice is not `oncePerSession`. The new key is a new rules row (as `usageNotices.ts:3` asks). It also needs `copy.notices.usage_view` in en and ar (`usageCopy.ts`), because `LimitSheet` reads `copy.notices[notice.key]`. Before calling `LimitSheet` "unchanged", check how it renders a non-limit notice (title, meters, offers, plan line). A plan line may need an additive prop with an unchanged default. `aiChat` is not in `MONEY_ENTRY_MODALS` (`usageStore.ts:68`), so the host does not hold events while the chat is open. |
| Regression risk | `NoticeHost` holds events while a money-entry modal is open (`MONEY_ENTRY_MODALS`); confirm `aiChat` is not in that set. Focus trap: `useDialogFocus` on the chat (`AIChat.tsx:110`) and `ModalShell` stacked; check focus moves to the sheet and back. Back button: LIFO guards (`useDismissable.ts:21-22`) should close the sheet first. |
| Test that proves it | Playwright in `e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts` style: open chat, type a draft, tap the ring; expect `[role=dialog]` usage sheet visible, `location.pathname` unchanged, draft still in the textarea; close the sheet, the chat is still open. It fails today (the pathname changes). Visual: owner review. |
| Confidence | high |
| Missing evidence | none for the cause; on-device focus/back behaviour of stacked overlays not verified. |

---

## Is BDG-011 on the same path as "conversation too long" (BDG-013)?

Partly yes: the same settle feeds both. The message is not one error mapped to the wrong copy.

- The "too long" line is `copy.longChat` ("This chat is getting long. A new one answers faster.", `buddgyChatCopy.ts:85`). It is shown when `item.longChat`, i.e. `out.soft` (`useBuddgyChat.ts:242`, `AIChatMessageList.tsx:113-118`). `soft` comes from `ai_chats.units >= ai_chat_units_soft` (30 000) at reserve (`0296` core, `v_soft`; `0298:85`).
- `ai_chats.units` grows by **every** settled request's units: hops, empty replies, blocks, aborts (`0302:52-54`). Units count fresh input 1:1 (`src/lib/server/ai/units.ts:13-16`), and every request resends the system prompt and all tool declarations (`route.ts:80-85`). So a few messages with tool hops, or a few failures, can cross 30 000 units. That is the BDG-013 symptom ("after a few messages"), and failed requests make it come sooner. **Hypothesis** until the lead's token query shows real per-request `in_tokens`/`cached_tokens`.
- Once soft, the client also compresses harder (only the last 2 items verbatim, `history.ts:7,35`), so context is lost even before a new chat.
- `rolled` (hard cap: `units >= 60000` or 40 turns) silently closes the server chat and opens a new one (`0296` core). The client collects `rolled` (`runTurn.ts:187`) but never uses it (`useBuddgyChat.ts:236-242`).
- The *wrong-message* mapping in this area is a different one: the hop cap and the 10-minute hop rule return `layer 'rate'`, which the chat shows as the spent-limit text (exit 11). Hand this to the BDG-013 owner: make `ai_chats.units` count only final turns (design step 6) and measure the prompt prefix.

---

## Existing tests covering the area

- `src/app/api/buddgy/turn/route.test.ts` (mocks quota; nothing on settle status)
- `src/lib/server/ai/buddgy/__tests__/gateway.test.ts` (stream: empty/blocked errors, truncation, a stall settles as aborted; asserts the status, not the charge)
- `src/lib/server/ai/quota.test.ts`, `units.test.ts`, `__tests__/units.test.ts`, `spendGuard.test.ts`, `pricing.test.ts`
- `src/lib/buddgy/client/__tests__/runTurn.test.ts`, `runTurnLastHop.test.ts`, `sse.test.ts`, `history.test.ts`, `usage.test.ts`
- `src/lib/usage/usageNotices.test.ts`, `onLimitDenied.test.ts`; `src/lib/ai/quotaDenied.test.ts`; `src/lib/i18n/buddgyChatCopy.test.ts`, `usageCopy.test.ts`
- `e2e/journeys/specs/g-buddgy.spec.ts` (request > approve > undo only); `e2e/api/round2/pro-rewards/*` (access, billing; no chat charging case); `e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts`
- No SQL-level test of `ai_quota_settle` status handling exists.

## Queries for the lead

Aggregates only, no personal data. Run one at a time; each is bounded by `created_at` on `ai_usage_events_user_cover_idx` or a small table. `EXPLAIN` first.

```sql
-- 1. Is selling on, and are the counters gone?
select public.billing_enabled();
select to_regclass('public.ai_credit_counters');

-- 2. Live plan limits that matter here.
select key, limits->'ai_credits_session' s, limits->'ai_credits_week' w, limits->'ai_req_per_min' rpm,
       limits->'ai_chat_units_soft' soft, limits->'ai_chat_units_hard' hard
from public.plans where key in ('free','plus','plus_trial');

-- 3. What failures cost (last 14 days), by feature and status.
select feature, status, count(*) n, round(avg(in_tokens)) avg_in, round(avg(cached_tokens)) avg_cached,
       round(avg(out_tokens)) avg_out, round(avg(cost_usd_micro)) avg_micro, sum(cost_usd_micro) total_micro,
       count(*) filter (where not credits_exempt and cost_usd_micro > 0) charged_rows
from public.ai_usage_events
where created_at > now() - interval '14 days' and feature in ('chat','chat_hop')
group by 1,2 order by 1,2;

-- 4. Hop share and how fast chats hit soft.
select count(*) chats, round(avg(units)) avg_units, round(avg(turns),1) avg_turns,
       count(*) filter (where units >= 30000) over_soft, count(*) filter (where closed) closed
from public.ai_chats where started_at > now() - interval '14 days';

-- 5. Unsettled reservations (function killed before settle).
select feature, count(*) from public.ai_reservations
where not settled and created_at > now() - interval '14 days' and expires_at < now() group by 1;
```

Also: the Vercel production values of `GEMINI_MODEL_FAST` / `GEMINI_MODEL_SMART` (names only, not the key).

## Decisions that need the owner

1. The policy table in BDG-011: refusal/safety = free? Stop after partial text = charged?
2. Whether "Quick / Thinking" becomes a user switch or stays automatic with an honest label; and whether the free Advisor answer gets real thinking (today it is `minimal`, the same level as Quick).
3. Whether the limit sheet should show every time a chat turn is blocked (today once per app session).

## Decisions that need Council

1. Turn-level charging: the server-only "flip on the final `done`" variant versus a client "turn finished" call. The server-only variant is simpler, and a client cannot use it to under-pay. Its gap: a turn that ends in write proposals ends on a `calls` frame, with no `done`. Recommendation: server-only. Treat a `calls` request as final when none of its calls is a read tool (the server knows each spec, `SPEC_BY_NAME`), because the client will not hop after it (`runTurn.ts:216`). A `calls` request with a read stays provisional until a later request with the same `turn_id` ends.
2. Whether `ai_chats.units` (soft/hard chat size) should count only final turns. This is shared with BDG-013.
