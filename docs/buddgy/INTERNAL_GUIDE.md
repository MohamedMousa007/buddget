# Buddgy: internal guide

Audience: engineering, support, product and operations. For the customer-facing explanation see `USER_GUIDE.md`.

## 1. What Buddgy is

An AI assistant that can read and change anything a user can in Buddget, from any screen, in English or Arabic. It is built around one rule: **the model proposes, the user approves, the device applies**.

- The model never touches the database. It calls typed tools.
- Read tools run on the device against the live local store, so numbers match what the screen shows (left to spend, net worth, goal progress use the same pure functions as the UI).
- Write tools only return a proposal (a card). Approval runs the app's own store actions, which already handle sync, cascades and conflicts.
- The server owns the prompt, tool list, model choice, quotas and usage logging. The client cannot change any of them.

## 2. Architecture

```
Device                                          Server (Vercel)                 Google
------                                          ---------------                 ------
composer
  |- local fast path (quick-add, month Qs)  ->  no network, zero tokens
  |- runTurn()  POST /api/buddgy/turn (SSE) ->  auth, validate, quota reserve
                                                select tools, build request  ->  Gemini
  <- text deltas, tool calls, done            <- stream, settle usage
execute read tools locally (<=3 hops)
write tools -> propose -> card -> approve -> apply (store actions) -> undo
```

Key files:

| Concern | Path |
|---|---|
| Gateway route | `src/app/api/buddgy/turn/route.ts` |
| Prompt, intent config | `src/lib/server/ai/buddgy/prompt.ts` |
| Request validation (untrusted client history) | `.../validate.ts` |
| Stream translation, raw parts for tool hops | `.../turn.ts` |
| Per-request tool narrowing | `.../select.ts` |
| Quota, auth, Gemini helpers | `src/lib/server/ai/{quota,auth,gemini,units}.ts` |
| Wire protocol | `src/lib/buddgy/protocol.ts` |
| Tool specs (what the model sees) | `src/lib/buddgy/tools/specs/*.ts` |
| Tool executors (run on device) | `src/lib/buddgy/tools/exec/*.ts` |
| Client orchestration | `src/lib/buddgy/client/*`, `src/hooks/useBuddgyChat.ts` |
| Local fast path | `src/lib/buddgy/local/*` |
| Chat UI | `src/components/features/ai-chat/*` |
| Chat copy (EN/AR) | `src/lib/i18n/buddgyChatCopy.ts` |

## 3. A turn, step by step

1. The user sends text. The device first tries the **local fast path** (`parseQuickAdd`, `matchLocalQuestion`). If it is confident, no model is called.
2. Otherwise `runTurn` builds a small **context slice** (~250 tokens: date and cycle, name, language, currencies, month totals, current screen and sheet, counts, up to 5 relevant memories) and a **compressed history** (last 6 items verbatim; older ones folded to one line each, by rules, no model call).
3. `POST /api/buddgy/turn`. The server authenticates (always), validates and size-caps everything, reserves quota, picks the tier from the intent (`action` and `answer` use the fast model, `advice` the smart model with a small thinking budget), narrows tools to the relevant domains and streams from Gemini with the API key in a header.
4. Text streams to the UI. If the model calls tools, the device runs them. Reads go back to the model (max 3 hops). Write calls become proposals; a batch of valid proposals ends the turn with no extra round trip.
5. The user approves a card. `apply` re-validates against the live store (the data may have changed), mutates through store actions, and returns an `undo`.

## 4. Tools

66 tools in 13 domains. Names, kinds and risk tiers (generated from the specs):

| Domain | Read | Write (risk) | Nav |
|---|---|---|---|
| reports | get_summary, spend_breakdown | | |
| expenses | search_expenses | add_expense (auto), update_expense, delete_expense (strong) | |
| income | list_income | add_income, update_income, mark_payday_received, delete_income (strong) | |
| debts | list_debts, get_debt | add_debt, add_installment_plan, add_credit_card, record_debt_payment, update_debt, clear_debt, delete_debt (strong), delete_debt_payment (strong) | |
| subscriptions | list_subscriptions | add, update, pause, resume, cancel, mark_paid, adopt_price, delete (strong) | |
| goals | list_goals | add_goal, update_goal, add_to_goal, achieve_goal, delete_goal (strong) | |
| savings | list_savings, get_net_worth | add_savings_account, deposit_to_savings, withdraw_from_savings, transfer_between_pockets, correct_savings_balance, add/update_investment_holding, delete_savings_account (strong), delete_investment_holding (strong) | |
| budget | get_budget, list_budget_plans | adjust_budget, activate_budget_plan (strong), delete_budget_plan (strong) | |
| payments | list_payment_methods | add, update, delete (strong) | |
| settings | get_settings | change_setting (per-proposal risk; base currency is strong) | |
| profile | get_profile | update_profile | |
| memory | get_memories | remember, forget_memory | |
| navigation | | | open_screen, open_setting, open_sheet |

Rules every tool follows:
- Entities are referenced by a 6-character **ref** (`refOf`). Writes resolve by ref or exact name, never by substring, and never fall back to a default when a named entity is missing.
- `propose` never mutates. `apply` calls `propose` again before writing.
- Risk: `auto` may apply immediately with an Undo toast (only a single, fully specified, small expense with no duplicate); `approve` waits for a tap; `strong` waits for a tap with a destructive card. Every delete is strong.
- Each write returns an `undo` that restores the original ids. This is possible because re-adding a deleted id now clears the server tombstone (see section 8).
- Not available to Buddgy by design: password, two-step, biometrics, SMS tracking arming, import/export, reset data, delete account, admin.

Adding a tool: write the spec in `specs/<domain>.ts` (one short line of description, minimal params), the executor in `exec/<domain>.ts` via `defineTools`, tests in `tools/__tests__/`, and labels in a domain copy file (EN and AR). `defineTools` fails at load if a spec has no executor. The footprint test fails if the tool prefix grows past its budget.

## 5. Token economy

Cost levers, in order of effect:
1. **Local fast path**: plain entries and common month questions cost nothing and work offline.
2. **Tool narrowing**: reads, navigation and memory always; write domains only when the message, the current screen or the tools already used point at them (all tools when nothing does). A focused request sends roughly a third of the declarations.
3. **Small context slice** instead of full entity lists; names and balances arrive through read tools only when needed.
4. **Tiers and caps**: `action` 400 output tokens, `answer` 600, `advice` 1200 with a 1024 thinking budget. Fast tier has thinking off.
5. **Static prefix**: the system prompt and tool declarations carry nothing per user, so provider-side caching applies. Per-turn facts ride on the latest user message.
6. **Rule-based history compression**; conversations are never stored or cached.
7. **Prompt discipline** (a decision ladder): answer from context, else the narrowest read, else the smallest write, reason at length only for real advice; no preamble, no restating cards.

Measure before tuning: `ai_usage_events` records prompt, cached and output tokens per call. Compare cached/prompt to confirm provider caching is landing. The full 66-tool prefix is about 7k tokens; narrowing brings typical requests to roughly 3k.

## 6. Limits and plans (hidden from users)

Every AI call reserves quota before the model runs and settles real usage after. One unit = 1 fresh input token; cached input = 0.1; output (including thinking) = 4. Defined in `src/lib/server/ai/units.ts`.

Layers (all per user, rolling windows, server-enforced, evaluated atomically under an advisory lock). Keys are flat, in the same style as the platform's limit catalog (`src/lib/entitlements/limits.ts` on the admin portal), and resolve the same way: individual override, then the user's plan, then the default. A number sets the limit, an explicit JSON `null` means unlimited, anything malformed is ignored.

| Key | Launch default | Meaning |
|---|---|---|
| `ai_chat_units_soft` / `ai_chat_units_hard` | 30000 / 60000 | Per chat. Soft: client compresses harder. Hard: chat closes and rolls into a new one. |
| `ai_chat_turns` | 40 | Turns per chat |
| `ai_chats_per_hour` / `ai_chats_per_day` | 30 / 100 | New chats, stops chat-hopping |
| `ai_units_5h` / `ai_units_24h` / `ai_units_7d` | 600k / 1.5M / 6M | Rolling windows |
| `ai_req_per_min` | 30 | Abuse guard |
| `ai_idle_minutes` | 30 | A chat idle this long starts fresh |
| `ai_chat_per_day` | unlimited | Chat messages per day (existing catalog key) |
| `receipt_scans_per_month` | unlimited | Successful receipt scans in 30 days (existing catalog key) |
| `voice_entries_per_day` | unlimited | Successful voice transcriptions in 24 hours (existing catalog key) |

Switching a surface off for one user: set `feature_overrides` to `false` for `ai_assistant` (chat), `receipt_scanning`, `sms_tracking`, `ai_voice`, `ai_budget`, or `ai_tool_<domain>` (for example `ai_tool_budget` removes the budget write tools). The entitlement rules (lapsed trial or period falls back to the default plan; `past_due` still keeps the plan) match `src/lib/entitlements/resolve.ts`.

Suggested free tier once pricing is decided: `ai_chat_units_soft` 20000, `ai_chat_units_hard` 40000, `ai_chat_turns` 25, `ai_chats_per_hour` 6, `ai_chats_per_day` 20, `ai_units_5h` 60000, `ai_units_24h` 150000, `ai_units_7d` 600000. An average chat is about 11k units (about 6 turns), a heavy advice chat about 25k.

Where to change them:
- Per plan: `plans.limits` (flat keys), for example `{"ai_units_5h": 60000}`.
- Per user: `user_entitlements.limit_overrides` and `feature_overrides`.
- Plan resolution: the user's entitlement row, otherwise the plan with `is_default`.

Example:

```sql
update plans set limits = limits || '{"ai_units_5h":60000,"ai_units_24h":150000}' where key = 'free';
update user_entitlements set feature_overrides = feature_overrides || '{"ai_tool_budget": false}' where user_id = '...';
```

What users see: nothing, until a limit is hit. Then the chat shows a friendly "resting until X" message (copy in `buddgyChatCopy.ts`). There are no meters. Approving an already proposed card is never blocked by a limit, and the local fast path always works.

Other routes share the same wheel through `reserveAiQuota`/`settleAiQuota`: `/api/ai` (legacy proxy, kept for shipped app versions), budget AI, receipt scan, voice transcribe (billed by audio size), SMS parse. The older per-feature caps (budget 15/hour, SMS 100/day) still apply on top.

Tables (RLS on; users can read their own usage; writes are service-role only): `ai_chats` (metadata only), `ai_usage_events`, `ai_reservations`. No message content is ever stored. Reservations expire after 3 minutes, so a crashed request cannot hold quota.

Reading usage:

```sql
select date_trunc('day', created_at) d, feature, tier, count(*), sum(units), sum(out_tokens)
from ai_usage_events where created_at > now() - interval '7 days' group by 1,2,3 order by 1 desc;
```

## 7. Security and privacy model

- **Auth**: every AI route requires a signed-in user (web cookies, native bearer token). Only a dev machine with Supabase unconfigured may run anonymously, and never in production.
- **The client is untrusted**: the gateway validates schema and sizes, accepts only text and well-formed function calls to known tools in history, and ignores everything else. The model's tool list is built server-side.
- **Isolation**: the server only sees what the signed-in user's device sends. Tools run on that device against that user's store; Supabase RLS protects the synced copy. A tampered client can only affect its own data.
- **Prompt injection**: tool results and user data (names, notes) are declared data, not instructions. Writes are only ever proposals; nothing the model says applies a change by itself.
- **Honesty**: success messages ("Done") come from the executor after a real write. The model only ever says what it will do.
- **Privacy**: no conversation storage; usage rows hold counts only. Each turn sends the small context slice plus whatever read tools return. The provider key is sent in a header, not the URL. `GET /api/ai` no longer reveals models or limits.
- **Kill switches**: `settings.enableAI` hides the orb for that user; `feature_overrides` set to false switches a surface or tool domain off per user (see section 6).

## 8. Sync and undo

Deletes are soft (`deleted_at`). Before this work, re-adding a deleted id stayed deleted on the server, so any "undo delete" would vanish on reload. `emitList` in `src/lib/supabase/remote/sync.ts` now sends `deleted_at: null` for rows that are inserts in the diff, while plain edits never touch `deleted_at` (so an offline edit cannot resurrect a row another device deleted). Test: `reviveTombstone.test.ts`.

## 9. Offline behaviour

| Situation | What happens |
|---|---|
| Plain entry ("coffee 45", Arabic too) | Parsed on device (confidence >= 0.85), applied or shown as a card, queued by normal sync |
| "How much did I spend?", "what's left?" | Answered on device from the store |
| Anything needing the model | Chat explains it needs a connection (no text queue yet) |
| Voice and receipts | Existing offline queue and replay (`usePendingAiJobs`) |

## 10. Testing and QA

- Unit: `npx vitest run src/lib/buddgy src/lib/server` (tools, undo, history, parser, gateway, quota math).
- Browser: Playwright against a mocked gateway (intercept `**/api/buddgy/turn` with SSE) at 390px, English and Arabic. Covers quick-add, approval card, edit, tool loop, delete and undo, quota message, new chat.
- Live evals (`src/lib/ai/buddgy.eval.test.ts`) call the real model and are not in CI. Run them manually after changing the prompt, tool descriptions or models, and compare tokens per chat alongside accuracy.
- Verify before shipping: `npm run lint`, `npm run test`, `npm run build` with dummy Supabase env.

## 11. Operations runbook

| Symptom | Check |
|---|---|
| "Buddgy is resting" for everyone | `ai_usage_events` volume; `ai_default_limits()`; a plan with a low `ai_*` limit; `feature_overrides` set to false |
| One user blocked | `select ai_effective_limits('<uuid>')` (service role) to see the merged limits; their recent `ai_usage_events` |
| Empty or blocked replies | Gateway logs `[buddgy]` with finish reason; Gemini safety blocks surface as "blocked" to the user |
| Tool calls failing after a model change | Gemini thought signatures must round-trip: `turn.ts` echoes raw parts unchanged; verify after switching models |
| Costs rising | Group `ai_usage_events` by `tier` and `feature`; compare cached to prompt tokens; check tool narrowing is applying |
| Model change | Set `GEMINI_MODEL_FAST` / `GEMINI_MODEL_SMART` env vars; no code change |

Env: `GEMINI_API_KEY`, `GEMINI_API_BASE` (optional; point at a stand-in upstream for end-to-end tests), `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `GEMINI_MODEL_LEGACY`, `GROQ_API_KEY` (voice), Supabase keys.

## 12. Known gaps

- No text queue for model-dependent messages when offline.
- Voice capture and receipt scan still use their own flows; they are quota-gated but not yet unified with the new tool layer, and the voice recap editor only edits the add actions it knows.
- Composer has no microphone or attach button yet.
- Goals for debt payoff or spending limits, recurring savings deposits, recurring debt reminders, trial conversion and pending plan changes have no tool.
- One-time income events cannot be edited or deleted by Buddgy.
- Withdrawing from savings to invest in a holding, and paying a debt from savings, are not tools.
- The admin portal has no UI for AI limits yet; edit `plans.limits` and `user_entitlements.limit_overrides`.
- Live eval coverage for the new gateway is manual.
