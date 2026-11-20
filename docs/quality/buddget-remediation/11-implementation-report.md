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
