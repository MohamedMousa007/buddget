# C2: Buddgy conversation context and action handling (BDG-013, BDG-015)

Investigator C2, read-only, 2026-11-20. Code read at `origin/main` 3d65b36f (this worktree). The store builds (iOS 146, Android vc180, built at 75e4ce8c) contain the same code: the new-chat nudge came in with 767f39ba, which is an ancestor of 75e4ce8c. None of the five named unmerged branches touches `src/lib/buddgy`, `src/lib/server/ai`, `src/app/api/buddgy`, `src/hooks/useBuddgyChat.ts` or `src/components/features/ai-chat` (checked with `git log origin/main..origin/<branch> -- <paths>`).

Measurement method. I bundled nothing and started no runner. A Node type-stripping script in the scratchpad imported `ALL_SPECS`, `toGeminiDeclaration` and `SYSTEM_PROMPT` and printed their JSON sizes. This is the same figure `src/lib/buddgy/tools/__tests__/footprint.test.ts` prints, without running vitest.

---

## BDG-013: "conversation is too long, start a new chat" after a few messages

| Field | Content |
|---|---|
| Issue ID | BDG-013 |
| Summary | The message is not a context overflow. It is a per-chat spend budget (30,000 units) shown as "This chat is getting long". A fixed prefix of about 7.6k tokens is billed on every request and every tool hop, so the budget can run out in 2 to 4 turns. When it trips, the history sent to the model is also cut from 6 items to 2. |
| Severity | P1. Continuity is lost and the user is pushed to discard the chat. No data is lost. |
| Reproducibility | Likely consistent when the implicit cache misses: ask 2 or 3 questions that each need a lookup (for example "how much did I spend on food", then "and on transport"), or ask one "build me a budget" (an advice turn). On the next reply the note "This chat is getting long. A new one answers faster." appears with a New chat button. Not proven on a device: see Missing evidence. |
| Platform | all (server-side counter, shared web bundle) |
| Affected components | `src/components/features/ai-chat/AIChatMessageList.tsx:113-117`, `src/hooks/useBuddgyChat.ts:217,238,242`, `src/lib/buddgy/client/history.ts:5-8,33-53`, `src/lib/buddgy/client/runTurn.ts:137-236`, `src/app/api/buddgy/turn/route.ts:61-115`, `src/lib/server/ai/buddgy/prompt.ts`, `src/lib/buddgy/tools/specs/*`, `src/lib/server/ai/units.ts`, `src/lib/i18n/buddgyChatCopy.ts:85,132` |
| Backend dependencies | `/api/buddgy/turn`, `/api/buddgy/usage`; SQL `ai_quota_reserve_v2` (0298) -> `ai_quota_reserve_v2_core` (0296:99-128), `ai_quota_settle_core` (0298:194-210), `ai_default_limits` (0298:83-89), `ai_effective_limits`; tables `ai_chats`, `ai_usage_events`, `ai_reservations`, `plans.limits` |
| Root cause | See below. The mechanism is confirmed. Why it trips so early is a ranked hypothesis. |
| Evidence | See below |
| Shared causes | BDG-011 (shared mechanism, not shared text); BDG-015 (a budget request is routed as `advice`, the most expensive tier) |
| Proposed solution | See "Options for Council". In short: separate the cost budget from context management. Compact by the size of the conversation, never by spend, and never before a minimum number of turns. Carry a summary over silently on a hard roll. Make the prefix discount deterministic. |
| Regression risk | Removing the nudge without fixing cost lets chats run to the hard cap of 60k units or 40 turns, so spend per chat roughly doubles until the prefix fix lands. Changing `compressHistory` affects every turn. Explicit caching adds a per-hour storage cost and one more failure mode (an expired cache). |
| Test that proves it | (1) A unit test on `compressHistory`: a 3-turn chat with `soft=true` must still send all 3 turns verbatim. This fails today, because `history.ts:35` keeps 2 items. (2) A route test in `src/app/api/buddgy/turn/route.test.ts`: a reserve returning `soft:true` must not shrink the history or set `longChat` while the conversation is below the size threshold. (3) A live check from the lead: the `ai_usage_events` query below, before and after the fix. |
| Confidence | High that the text equals the soft spend budget. Medium that the uncached prefix is the main driver; the cache-hit data would settle it. |
| Missing evidence | The real `cached_tokens` ratio on live; any per-plan override of `ai_chat_units_soft` in `plans.limits`; the real Gemini 3.5 token count of the declarations (chars/4 is an approximation). |

### Where the text comes from (confirmed)

- Copy: `buddgyChatCopy.ts:85` reads "This chat is getting long. A new one answers faster." Arabic is at `:132`.
- Render: `AIChatMessageList.tsx:113-117` shows it, with a `New chat` button, on the last done reply when `item.longChat` is set.
- The flag: `useBuddgyChat.ts:242` sets `longChat: out.soft`. In `runTurn.ts:188`, `soft ||= ev.soft` comes from the server's `meta` frame (`route.ts:108`, `soft: quota.soft`).
- Server: `quota.ts:137` passes `row.soft`. SQL `0296_s6_sms_off_per_minute.sql:126` sets `v_soft := v_chat.units >= (L ->> 'ai_chat_units_soft')::numeric`. The default is 30000 (`0298:85`), described in `limits.ts` as "Usage in one chat before its history is compressed harder".
- `ai_chats.units` grows on every settled call in the chat: chat and `chat_hop`, ok, error and aborted alike (`0298:205-207`, `update ai_chats set units = units + p_units`).
- Units per call: fresh input x1, cached input x0.1, output and thinking x4 (`units.ts:1-17`, `:35-41`).
- No other "too long / new chat" text exists in `src/` for Buddgy. `rg "too long|new chat|getting long"` finds only this. A provider error, a size 400 or a MAX_TOKENS finish all surface as other text: "Couldn't finish that. Try again." (`buddgyChatCopy.ts:103`) or the "Keep going" button (`AIChatMessageList.tsx:103-106`). It is therefore neither a message-count cap, nor a token-window check, nor a mapped provider error.

### What one request contains (measured from source)

| Part | Where | Size | Resent? |
|---|---|---|---|
| System prompt | `prompt.ts:8-25` | 2,207 chars, about 550 tok | every request and every hop |
| Tool declarations | `route.ts:81-85`, all 67 tools always (16 read, 47 write, 4 nav) | 28,064 chars, about 7,000 tok (largest: debts 4,847, savings 4,140, subscriptions 3,767, income 2,724) | every request and every hop |
| NOW context: date, cycle, month figures, route, counts, up to 5 memories | `client/context.ts:36-48,53-62`; trimmed at `plan.ts:4,29-32` | at most 1,500 chars (3,000 for advice), typically 400-700, about 100-175 tok; one memory is at most 280 chars (`useFinanceStore.ts:183`) | every request and every hop (it rides on the last user message, `turn.ts:11-15`) |
| Carry (older turns) | `history.ts:49-51`, one 70-char snip per old item | at most 1,000 chars, about 250 tok | every request |
| Verbatim history | `history.ts:5,35-46`: last 6 items (2 when soft), model text clipped to 2,800 chars | typically 2-5k chars, about 500-1,250 tok; server cap 24,000 chars (`protocol.ts:51`) | every request; text only, so **no tool results or parts carry across turns** |
| In-turn tool loop | `runTurn.ts:213-227`: each hop appends model `parts` (with thought signatures up to 4,000 chars each, `validate.ts:7,17`) and results of up to 5,000 chars each (`runTurn.ts:80`) | 0-15k chars | resent in full on each later hop of the same turn (up to 2 hops on Free, 3 on Pro, `plan.ts:6`) |
| Output cap | `prompt.ts:34-38` | 400 / 600 / 1,200 tok (action / answer / advice); advice also thinks (`thinkingBudget` 1024 maps to `thinkingLevel: 'medium'` on 3.x, `gemini.ts:32-36`; fast maps 0 to `minimal`) | billed x4 |

Token counting. There is no tokenizer and no check against a model window. The reserve estimate is chars/4 plus the output cap x4 (`units.ts:45-47`, `route.ts:69,74`). Settlement uses Gemini's real `usageMetadata` (`turn.ts:77-80`). The only size guards are character caps: `TURN_LIMITS` (`protocol.ts:48-55`: 16 messages, 4,000 per message, 24,000 total, 3,000 context, 1,200 carry) and a body of 256 KB (`route.ts:23`). The model in use (`gemini-3.5-flash-lite`, `gemini.ts:11-13`) has a window far larger than the roughly 10-15k tokens the largest request can reach. **The context never gets close to too long.**

Caching. The code relies on Gemini implicit caching only. The prefix is kept static and ordered for it (`prompt.ts:4-6`, `route.ts:80`), but there is no `cachedContent` or explicit cache anywhere in `src/lib/server/ai/gemini.ts`. Implicit caching is best-effort, so a cache hit is not guaranteed.

### Units arithmetic

Per model call, uncached: about 7,600 (prefix) + 300-1,500 (context, carry, history) + output x4 (about 100-300 tok, so 400-1,200; advice up to (1,200 + thinking) x4) gives **about 8.5-10k units for a plain call, and 12-15k or more for an advice call**.

- A turn with one read is 2 calls, about 17-21k units. A Free turn using both hops is 3 calls, about 26-31k.
- So, uncached: **30,000 is crossed after 3 plain turns, after 2 turns with a lookup, after 1 lookup-heavy turn plus one more, or after about 2 advice turns.** That matches "after a few messages".
- Cached at 0.1: the prefix costs about 760 and a call 2-3.5k, so the soft line arrives only after about 9-14 calls, roughly 5-10 turns. That would not feel like "a few".

### Root cause, ranked

1. **Confirmed mechanism, high confidence.** The "too long" note is a spend meter (`ai_chats.units >= ai_chat_units_soft`). It has no relation to context size, and when it trips it actively removes context (item 3).
2. **Hypothesis H1, medium-high: the 7.6k-token prefix is billed in full when the implicit cache misses.** That makes each call cost about 9k units and burns the 30k budget in 2-4 turns. The tool loop multiplies it, because each hop is a separate full-prefix request. Discriminator: the `cached_tokens / in_tokens` ratio in `ai_usage_events` (Q1).
3. **Confirmed contributor: failed and aborted calls are charged into the same chat counter.** An abort before usage is settled at the estimated prompt (`route.ts:111`, `estInputTokens`, about 8-10k). Empty or blocked replies settle with real usage (`turn.ts:133-136`). An idle stall settles as aborted (`turn.ts:142-151`). `retry` (`useBuddgyChat.ts:267-274`) re-sends the same turn. Each unanswered attempt brings the nudge closer. This is the link to BDG-011.
4. **Confirmed contributor: budget, plan, "how should I save" and similar phrases are routed as `advice`** (`classifyIntent.ts:7-8`), the smart tier with thinking and a 1,200-token cap. One or two such turns can reach 30k on their own.
5. **Hypothesis H2, low: a plan override sets a lower soft limit than 30,000.** `0298` only merges credit keys into `plans.limits`, so the default probably stands. Q3 confirms it.

### Context loss that exists today, independent of the nudge

Each of these breaks "never loses continuity because context grew" on its own:

- **Soft shrinks the verbatim window from 6 items to 2** (`history.ts:7,35`; `useBuddgyChat.ts:217,238`). After the nudge, the model sees only the previous exchange plus 70-character snips.
- **Rule-based carry is lossy.** Older turns become `asked: <70 chars>` or `replied: <70 chars>`, capped at 1,000 chars with the oldest dropped (`history.ts:11,13-16,49-51`). Numbers and names in old answers are mostly cut.
- **Tool results never carry across turns.** History is text only (`history.ts:39-45`). A follow-up such as "and the second one?" after a list has to re-read, which costs another full-prefix call.
- **A 30-minute idle gap wipes the chat on the next send** (`useBuddgyChat.ts:22-23,177-182`). The server has the same idle rule (`ai_idle_minutes` 30, `0298:86`; `0296:116-118`).
- **The chat lives only in React state.** `AIChat` stays mounted in `ModalProvider.tsx:96`, so closing and reopening keeps it, but an app restart or reload loses it. Nothing is persisted.
- **A hard roll (60,000 units or 40 turns, `0296:119-123`) is half-handled.** The server closes the chat and opens a new id with `rolled: true`. `quota.ts:35` says "the client should carry its summary over", but `useBuddgyChat.ts` never reads `out.rolled`. In practice the client keeps sending its local history, so model-side continuity survives by accident. `softRef` resets because the new chat reports `soft:false`.
- **Memory.** Long-term facts are the user-approved `remember` tool (`specs/memory.ts`, at most 280 chars each), injected as up to 5 keyword-relevant facts per turn (`context.ts:53-62`). Nothing is summarised automatically.
- **What "New chat" clears** (`useBuddgyChat.ts:74-85`): every local item, `chatId` (so the server opens a new `ai_chats` row, which counts toward `ai_chats_per_hour`/`_day`), the soft flag and the read taint, and it aborts the turn in flight. Memories stay. **Nav consent stays**: it is a module variable, reset only by `clearBudgetData`.

### Options for Council (BDG-013)

The rule: continuity is never lost because context grew, and short chats never compact. Two separate fixes are needed: **(A) stop using spend as a context signal**, and **(B) lower the spend per call**. Neither alone is enough.

| Option | What | Token cost | Latency | Loss risk | Build size |
|---|---|---|---|---|---|
| 0. Decouple (prerequisite) | Drop `soft` from `compressHistory` and from the `longChat` note. Keep `soft`/hard as a server cost guard only. Show a usage-style notice from the usage wheel only when the hard roll actually happens. | 0 | 0 | none | S: `history.ts`, `useBuddgyChat.ts:217,242`, `AIChatMessageList.tsx:113` |
| B1. Deterministic prefix discount | Explicit Gemini `cachedContent` for system prompt plus tools, one cache per disabled-tools set (in practice one or two), refreshed on a TTL; fall back to implicit on a cache error. | cuts each call from about 9k to about 1.5-3k units; adds cache storage cost (small for about 8k tokens) | 0 (one extra call per TTL) | none | M: `gemini.ts`, `route.ts` |
| B2. Leaner prefix | Shorten declarations (debts, savings and subscriptions are 45% of them). Or send a domain subset chosen by `classifyIntent`; this breaks the single cached prefix, so pair it with B1 per subset. | -20 to -50% of prefix | 0 | model picks the wrong tool if the subset is wrong | S-M |
| C1. Rolling summary | When the conversational part passes a size threshold, one model call rewrites a summary of everything older than the verbatim window. | one extra fast call (about 1-2k in, 200 out) each time the threshold is crossed | +0.5-1.5 s if inline, 0 if run after the reply | medium: a summary can drop or distort a figure | M |
| C2. Incremental summary | Each item that leaves the verbatim window is folded into the carry by a small call, or by a richer rule fold that keeps amounts, refs and proposal outcomes. | rule: 0; model: about 300 tok per roll-off | 0 (after the reply) | low-medium | S (rule) / M (model) |
| C3. Selective retrieval | Keep all turns on the device; per turn, add the top 1-2 older turns verbatim by word overlap, reusing the `relevantMemories` scorer (`context.ts:50-62`). | +0-2k chars, only when relevant | 0 | misses paraphrased references | S |
| C4. Hybrid (recommended) | Option 0, plus a verbatim window **by characters, not items** (for example 10-12k chars; no compaction below 6 turns or before the budget fills), plus a richer rule carry (C2 rule) and C3 retrieval. A model summary (C1) only once a chat passes about 20 turns or at a hard roll, and on a hard roll the summary is carried over silently (wire `out.rolled`). Persist the chat locally so a reload does not wipe it. Optionally B1. | baseline plus about 1-2k chars; a summary call only in long chats | 0 for short chats | low | M overall; each piece ships alone |

**Recommendation:** ship 0 and B1 first, since together they remove the visible symptom and its cost driver. Then ship C4 in slices: character window, rule carry, retrieval, then the summary at roll.

Measure before and after with Q1 and Q2: average `in_tokens`, `cached_tokens` and units per call, and turns per chat at 30k.

---

## BDG-015: asking Buddgy to set up a budget opens the Budget Builder behind the chat

| Field | Content |
|---|---|
| Issue ID | BDG-015 |
| Summary | The model calls `start_budget_setup`. If any earlier nav card was approved in this app session and no read has run in this chat, the client runs it without asking: it sets `budgetStudioRequested` and calls `navigate('/budget-setup')`. Nothing closes the chat modal, so the guided setup opens underneath it. |
| Severity | P2 (UX and trust; no data change) |
| Reproducibility | Consistent: (1) In a fresh app session ask "open my debts" and approve the "Open a screen" card. (2) In a new chat, with no lookup first, ask "set up a budget for me". The Budget page and guided setup open behind the still-open chat, with no card. Without step 1 the user gets a generic "Open a screen" card instead; approving it does the same thing, also behind the chat. |
| Platform | all |
| Affected components | `src/lib/buddgy/tools/specs/navigation.ts:70-76`, `src/lib/buddgy/tools/exec/navigation.ts:34-38,160-191`, `src/lib/buddgy/tools/navConsent.ts`, `src/lib/buddgy/client/runTurn.ts:115-118,213-216`, `src/lib/server/ai/buddgy/prompt.ts:25`, `src/components/features/budget/useBudgetTakeover.ts:32-38`, `src/hooks/useBuddgyChat.ts:38`, `src/lib/navigation/navigate.ts:28-38`, `src/lib/navigation/shellRoutes.ts:25` |
| Backend dependencies | none (client-side execution); `/api/buddgy/turn` only relays the function call |
| Root cause | Confirmed. See the path below. |
| Evidence | See below |
| Shared causes | BDG-013: the same request is classified `advice` (`classifyIntent.ts:7`), the most expensive tier. Any other nav result also lands behind the chat (open_screen, some open_setting paths). |
| Proposed solution | The action-intent protocol below. For the budget case: `start_budget_setup` always returns a choice card ("Open Budget Builder" / "Build it here"). When the user picks Open, close the chat (`setActiveModal(null)`) before navigating. |
| Regression risk | More taps for users who explicitly said "open X". This is mitigated by the explicit-request rule below. Closing the chat on navigation changes the current behaviour of open_screen. |
| Test that proves it | A unit test in `src/lib/buddgy/tools/__tests__/navigation.test.ts`: with `grantNavConsent()` already called, `executeCalls([{name:'start_budget_setup',args:{}}], ctx)` must return a proposal and must not call `navigate`. This fails today: it navigates directly (`runTurn.ts:115`). A Playwright case in `e2e/journeys/specs/g-buddgy.spec.ts`: "set up a budget" shows a choice card, and the chat is closed when Open is tapped. |
| Confidence | High |
| Missing evidence | Whether the model text alongside the call is empty. A successful nav sets `needsModel=false` (`runTurn.ts:118,216`), so no second hop explains what happened, and the bubble may be empty or contain only the lead-in. Needs a device check. |

### Exact path (confirmed)

1. The user types "set up a budget". `classifyIntent.ts:7` matches it, so the intent is `advice`, the smart tier (`prompt.ts:37`).
2. The model is told to prefer navigating: `prompt.ts:25` says "You can open any screen or sheet for the user with the navigation tools when that is the better way to finish something". The tool description (`specs/navigation.ts:74`) says to use it "when the user wants a new budget or to redo theirs". Nothing asks the model to offer a choice.
3. The server relays the `calls` frame (`turn.ts:131-132`). The client runs `executeCalls` (`runTurn.ts:213`).
4. `runTurn.ts:115`: `entry.nav && ((hasNavConsent() && !ctx.afterRead) || !entry.write)`. Every nav tool also has an `askFirst` write (`exec/navigation.ts:189-191`), so it navigates directly only when `hasNavConsent()` is true and no read has run in this chat (`afterRead` is set from `tainted || reads.length > 0`).
5. **Consent is one module boolean** (`navConsent.ts:2`). It is granted by approving **any** nav card (`exec/navigation.ts:181`), shared by all four nav tools and all chats, and reset only on sign-out or data clear (`clearBudgetData.ts:70`). "New chat" does not reset it. One "open debts" approval therefore silently authorises a later "start the budget builder".
6. With consent: `start_budget_setup` (`exec/navigation.ts:34-38`) calls `ui().requestBudgetStudio()` and then `navigate('/budget-setup')`. `/budget-setup` is a shell route (`shellRoutes.ts:25`), so `navigate.ts:32-37` swaps the view in memory. `useBudgetTakeover.ts:32-38` sees the flag and opens the studio.
7. **The chat never closes.** It is open while `activeModal === 'aiChat'` (`useBuddgyChat.ts:38`), and neither `navigate` nor `start_budget_setup` touches `activeModal`. `AIChat` stays mounted in `ModalProvider.tsx:96`. The builder is therefore behind the chat.
8. Without consent: `askFirst.propose` builds the card. `TARGET_ARG` (`exec/navigation.ts:160`) has no `start_budget_setup` key, so the card reads only "Open a screen" with the target "Open a screen" (`copy.ts:14`). It never names the Budget Builder, and it offers no "do it here" option. Approving it runs step 6 and grants global consent.

### Every action Buddgy can trigger

Inventory from `ALL_SPECS` (67 tools), the local quick-add path, and seeded sends. "Asked first" means today's behaviour.

| Class | Tools | Asked first today? |
|---|---|---|
| **Read** (data goes to the model, nothing changes) | `get_summary`, `search_expenses`, `spend_breakdown`, `list_income`, `list_debts`, `get_debt`, `list_subscriptions`, `list_goals`, `list_savings`, `get_net_worth`, `get_budget`, `list_budget_plans`, `list_payment_methods`, `get_settings`, `get_profile`, `get_memories` (16) | No. A visible "Checking…" step and a "Checked: …" note (`runTurn.ts:113,223`; `AIChatMessageList.tsx`). Amounts are redacted under balance privacy (`runTurn.ts:111-112`). |
| **Navigate** (changes screen, chat stays open on top) | `open_screen` (11 screens, `specs/navigation.ts:4-16`); `open_setting` for page-route settings: profile, password, twoFactor, biometric, appLock, memories, notifications and others (`exec/navigation.ts:49-52`) | Card once per app session, then silent (except after a read in this chat). |
| **Open a sheet** (replaces `activeModal`, so the **chat closes**) | `open_sheet`: add_expense, add_payment_method, new_payday, assign_income, add_debt, pay_debt, record_debt_payment (`useSettingsStore.ts:309-339` all set `activeModal`). `open_setting` with an action: currencies, converter, feedback, about, export (exportData/restoreBackup), notCounted via `openSettingsSheet`; household and lifestyle via `setActiveModal`. | Same consent rule. The user finishes the form, so nothing is written without their own submit. |
| **Start a flow** | `start_budget_setup` | Same consent rule (the BDG-015 bug) |
| **Write financial data** | the 43 expense, income, debt, subscription, goal, savings, budget and payment writes | Proposal card with approve (`risk: 'approve'`); deletes and `activate_budget_plan` use `strong` (destructive styling). **`add_expense` auto-applies** with an Undo toast when the amount is at most 10,000 in base currency, the date is within 7 days, no read has run in the chat, and at most 5 per minute (`autoApplyGuard.ts`, `exec/expenses.ts:131-134`, `useBuddgyChat.ts:165`). **The local quick add** ("coffee 45") never reaches the model and auto-applies through the same path (`useBuddgyChat.ts:192-204`). |
| **Change settings** | `change_setting` | Card, except **auto-apply** (with Undo) for theme, language, showCents, goldStrip, onlyMyCurrencies, secondaryCurrency, tips and learning when no read has run (`exec/settings.ts:85,221`). Security, SMS and data settings are not changeable (`specs/settings.ts:34`). |
| **Profile and memory** | `update_profile`, `remember`, `forget_memory` | Card (approve) |
| **Start a purchase** | none | No tool exists. The paywall or limit sheet can appear after a quota denial (`runTurn.ts:54,65` -> `onLimitDenied.ts:14-21`). That is app-triggered and fires only for a spent session or week limit while billing is on; the model cannot trigger it. |
| **Seeded sends** | not model output, but the chat sends without typing: `openAiChatWithSeed(prompt, true)` from a Buddgy tip (`ModalProvider.tsx:103`, `useBuddgyChat.ts:283-288`). Pending captures and voice only pre-fill (`send=false`). | The tip tap counts as the yes |

The legacy voice path (`src/lib/ai/aiActionHandlers.ts`, used by `useVoiceExpense.ts` and `VoiceRecapEditor.tsx`) is a separate action executor outside the chat. It is out of scope here, but one protocol should cover it later.

### Action-intent protocol, built on the existing handler

Reuse what exists. `executeCalls` (`runTurn.ts:95-135`) is the single validator and dispatcher. `makeProposal` and `ProposalCard` are the confirm surface, `askFirst` is already a nav-to-proposal adapter, and the `ToolRisk` levels `auto`/`approve`/`strong` (`spec.ts:6`) already exist.

1. **The model proposes; it never executes.** Every tool call returns either data (read) or a proposal. Nav tools stop executing directly in `executeCalls`; `runTurn.ts:115` reduces to "nav executes only via an approved proposal or the explicit-request rule".
2. **Each spec declares its effect class**, as an additive field on `ToolSpec`: `read | navigate | sheet | flow | write | setting | purchase`. The app, not the model, maps the class to a policy:

| Class | Policy (proposed) |
|---|---|
| read | No confirmation. Visible "Checked" note (as today). |
| navigate, sheet | A one-tap chip in the reply ("Open Debts"). It runs directly only when this user message explicitly asked to open or go to that target, checked on the device with a lexicon (`src/lib/buddgy/local/lexicon.ts`) and not taken from a model flag. Running it **closes the chat first**. Consent is per target and per chat, not global; this replaces `navConsent.ts`. |
| flow (budget setup, future guided flows) | **Always a choice card**: "Open Budget Builder" / "Build it here". "Here" means Buddgy asks the questions in chat and proposes the plan through the existing `adjust_budget` (and a new create-plan write; none exists today, `specs/budget.ts`). The card names the flow; add a `start_budget_setup` entry to `TARGET_ARG` and copy. |
| write | Proposal card (as today). Keep `auto` plus Undo only inside the existing bounds, and show a visible applied notice (exists: toast plus "Done"). |
| setting | Card. Cosmetic auto-apply plus Undo may stay as a visible notice. |
| purchase | Never from the model. Only a user tap on an app-owned paywall. |

3. **The app validates** before showing anything, as the executors already do (refs, bounds, enums). An invalid proposal goes back to the model as an error (as today).
4. **What the model sees.** The tool result says "offered to the user" (like `pending_user_approval`), so the model words its reply as an offer, never as "opened". Change `prompt.ts:25` to: "offer to open a screen or start a flow; the app asks the user".

### Options for Council (BDG-015)

| Option | Description | Build | Risk |
|---|---|---|---|
| P1. Minimal | Make `start_budget_setup` always a card (name it in `TARGET_ARG` and copy), and close the chat on any nav apply. | S | Leaves global consent for screens. |
| P2. Protocol (recommended) | The effect-class field plus the policy table above, per-chat and per-target consent, the explicit-request rule, close-on-navigate, and a choice card for flows. "Build it here" ships first as "Buddgy asks, then proposes `adjust_budget` lines" on an existing draft plan. | M | Touches every nav test; needs copy in English and Arabic. |
| P3. Full | P2 plus a chat-native budget builder (a new create-plan write tool and reuse of `src/lib/ai/budgetPlannerAi.ts`), plus moving the legacy voice executor onto the same protocol. | L | Larger surface to test. |

**Confirm versus notice:** confirm for flow, write (outside auto bounds), setting (non-cosmetic), profile, memory and any delete (strong). Visible notice for read, explicit-request navigation, bounded auto add_expense and cosmetic settings (with Undo). Purchase is never available from Buddgy.

---

## BDG-013 and BDG-011: shared cause?

They do not share the text. A failed or unanswered request shows "Couldn't finish that. Try again." (`buddgyChatCopy.ts:103`) or a quota line, never `longChat`.

They do share a mechanism: unanswered requests are charged into the same per-chat counter that drives the nudge.
- Aborts before usage settle at estimated input (`route.ts:111`).
- Empty or blocked replies settle with Gemini's real usage (`turn.ts:133-136`, status `error`).
- An idle stall settles as aborted (`turn.ts:142-151`).
- A last-hop failure throws after earlier hops were already settled (`runTurn.ts:218-220`).
- Each settle adds to `ai_chats.units` (`0298:205-207`), and `retry` re-runs the full turn.

So BDG-011 failures bring BDG-013 forward. The fix owner for BDG-011 (refund or no-charge on failure) should also exclude failed calls from `ai_chats.units`.

## Existing tests covering the area

- `src/lib/buddgy/tools/__tests__/navigation.test.ts` (nav tools and `start_budget_setup` ok), `footprint.test.ts` (prefix under 9,000 approx tokens), `guardrails.test.ts`, the per-domain tests in `tools/__tests__/`.
- `src/lib/buddgy/client/runTurnLastHop.test.ts`, `src/lib/buddgy/client/usage.test.ts`.
- `src/app/api/buddgy/turn/route.test.ts`, `src/lib/server/ai/buddgy/plan.test.ts`, `src/lib/server/ai/buddgy/__tests__/validate.test.ts`, `src/lib/server/ai/buddgy/__tests__/gateway.test.ts`.
- `src/lib/i18n/buddgyChatCopy.test.ts`, `src/lib/ai/buddgy.eval.test.ts`, `src/lib/ai/buddgyBrain.test.ts`.
- e2e: `e2e/journeys/specs/g-buddgy.spec.ts`; API suites `e2e/api/lifecycle.mjs`, `concurrency.mjs`, `input-matrix.mjs`, `latency.mjs`, `auth-matrix.mjs` mention Buddgy.
- No test covers `compressHistory` under `soft`, the `longChat` note, or nav consent carrying across chats.

## Queries for the lead

Counts and averages only, read-only, bounded by time and LIMIT.

```sql
-- Q1: is the prefix cached? units per call by feature and status, last 7 days
select feature, status, count(*) as n,
       round(avg(in_tokens)) as avg_in, round(avg(cached_tokens)) as avg_cached,
       round(avg(out_tokens)) as avg_out, round(avg(units)) as avg_units
from public.ai_usage_events
where created_at > now() - interval '7 days' and feature in ('chat','chat_hop')
group by feature, status order by feature, status limit 20;

-- Q2: how many turns a chat has when it reaches the soft line
select width_bucket(turns, 0, 40, 8) as turns_bucket, count(*) as chats
from public.ai_chats
where started_at > now() - interval '30 days' and units >= 30000
group by 1 order by 1 limit 20;

-- Q3: any per-plan override of the chat limits
select key, limits -> 'ai_chat_units_soft' as soft, limits -> 'ai_chat_units_hard' as hard, limits -> 'ai_chat_turns' as turns
from public.plans limit 20;

-- Q4: share of chat units spent on failed or aborted calls (BDG-011 link), last 7 days
select status, count(*) as n, sum(units) as units
from public.ai_usage_events
where created_at > now() - interval '7 days' and feature in ('chat','chat_hop')
group by status limit 10;
```

Run `EXPLAIN` first. `ai_usage_events` needs an index on `created_at` (or `(feature, created_at)`) for Q1 and Q4; `ai_chats` needs one on `started_at`.

## Decisions that need the owner

- Should a "New chat" button stay visible at all? Under the rule it would be offered only at a real hard roll, and the roll would carry a summary silently.
- "Build it here" for budgets: is a chat-native builder in scope (P3), or does the first version offer "Buddgy asks, then proposes lines" (P2)?
- When Buddgy opens a screen at the user's explicit request, should the chat close or minimise to the orb?
- Should explicit Gemini caching (it has a storage cost) be approved?

## Decisions that need Council

- BDG-013 context strategy: options 0, B1, B2, C1-C4 (recommended: 0 + B1 now, then C4 in slices).
- BDG-015 action-intent protocol: P1, P2 or P3 (recommended: P2), and the confirm-versus-notice table.
- Whether failed or aborted calls should count toward `ai_chats.units`; decide jointly with the BDG-011 owner.
