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
- **Retry** of a turn that was already charged gets one free re-run, its tool steps included: no credit check, no Sparks, no units, and it does not count as a chat turn. The re-run is used up only once it shows something, so a re-run that fails again leaves the next Retry free. After a shown re-run, a further attempt is paid. The per-minute rate limit and the unit safety windows still apply.
- **A turn left open** (the phone stopped between steps) is charged when the next message arrives. Only a failure the server itself saw makes a turn free.
- **Hops inherit their funding** (credits or Sparks) from the turn's first call.

**Readings that need the owner's sign-off:**
- "A turn whose actions were applied is charged" is read as "a proposal or navigation was shown". Applying happens later on the phone, where the server cannot see it.
- A free re-run replays the model rather than returning a stored answer. Nothing stores reply text today.
- There is no `attempt` column. The hop flag and the turn's state tell a Retry from a next step.
- A new `ai_turns` table holds one small row per message. Rows are deleted after two days, on the user's next message.
- A turn left open (abandoned) is charged.
- A paid attempt after a shown re-run is charged again.
- A turn freed in full keeps its +1 on the chat's turn counter.

| Item | Files | Status |
|---|---|---|
| SQL: `ai_turns` table, `turn_id` on reservations and events, reserve and settle rules | `supabase/migrations/0338_ai_one_charge_per_turn.sql`, `database.types.ts` | Proven on live in a rolled-back transaction (6 cases below), then applied. Each function has one signature and `service_role` only. `EXPLAIN` of both new queries uses the new indexes. Advisors report nothing new. |
| Route: turn id to reserve; tool step and "seen" to settle | `route.ts`, `turn.ts`, `quota.ts`, `validate.ts`, `protocol.ts` | **Automated verification** (runner job 5) |
| Phone: one turn id per message, reused by Retry | `useBuddgyChat.ts`, `runTurn.ts`, `chatTypes.ts` | **Automated verification** (runner job 5). Retry on a device: **Native verification required**. |

## Tests for step 3

**Live SQL, rolled back: passed** (8 cases, rerun after the advisor found that a re-run's tool steps were billed per request; fixed in 0338 and re-applied before any client sent a turn id).

| Case | Result |
|---|---|
| No turn id | Unchanged |
| Two lookups and an answer on Sparks | One Spark charge on the summed cost |
| Lookup, then the final call fails | Turn free, all rows exempt with the cost logged, chat units back to 0, no Sparks |
| Stop after text | Charged once |
| Retry of a charged turn | Free re-run: units 0, chat turns unchanged, no Sparks. The third attempt is paid. |
| Retry of a charged turn that does a lookup and then answers | Both re-run rows free and exempt, chat units unchanged, no new Sparks |
| Retry that fails with nothing shown | The next Retry is still free; after it shows, the next attempt is paid |
| Open turn followed by a new message | Charged |

**Unit tests: passed (runner job 5).** Route check `e2e/api/buddgy-turns.mjs`: 9 of 9 against the real route and live PostgREST.
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

## Step 4: BDG-014, the keyboard no longer covers the Buddgy chat (2026-11-20)

The chat panel used to be placed from the full window height and moved only on a window resize. iOS sends no resize when the keyboard opens, so the keyboard covered the message box.

- **Pure helper:** the panel's position and size now come from `panelGeometry.ts`, which reads the visible part of the screen (the visual viewport). The panel moves when that area changes, when iOS pans it, and when a text field gains or loses focus.
- **With the keyboard up:** the panel takes the whole visible height above the keyboard and stops leaving room for the tab bar, the header and the home indicator.
- **Detecting the keyboard:**
  - iOS: the visible area is more than 120px shorter than the window.
  - Android: the whole window shrinks there, so a focused text field is the sign.
- **The orb:** it no longer saves a new position while the keyboard is up. On Android a single keyboard open used to move the orb up for good.

No Keyboard plugin, no change to native config.

| Item | Files | Status |
|---|---|---|
| Geometry and keyboard rule | `src/components/features/ai-chat/panelGeometry.ts` (new), `AIChat.tsx` | **Automated verification** (runner job 6). Five cases: no keyboard is unchanged, the panel sits above the iOS keyboard, it follows a panned view, Android stops reserving the tab bar, desktop is untouched. |
| Orb keeps its place | `src/components/ai/AIChatBubble.tsx` | **Native verification required** (Android: open the keyboard in chat, close it, the orb stays put) |
| How it looks on a phone | | **Native verification required** (iPhone and Android: tap the composer, the header and composer both stay in view) |

## Step 5: BDG-018, the orb follows the finger and springs to an edge (2026-11-20)

While dragged, the orb follows the finger on both axes, kept inside the screen. On release it glides (240 ms) to the nearer edge, judged by where the orb's centre is.

- **Dead zone:** releasing within 24px of the middle keeps its current side.
- **Saving:** the new position is saved once, on release, instead of on every frame.
- **Mirroring:** the side is physical (left or right of the screen), so Arabic needs no extra rule.
- **The hint:** not built. The plan left it as an owner decision, and the Council's view was that following the finger is hint enough.

| Item | Files | Status |
|---|---|---|
| Snap side, dead zone, screen limits | `panelGeometry.ts` (`snapSide`, `dragLeft`), `AIChatBubble.tsx` | **Automated verification** (runner job 6) |
| How the drag feels | | **Native verification required** (drag sideways on a phone, release near the middle, release past it) |

## Step 6: BDG-015, Buddgy asks before moving you, per place, and gets out of the way (2026-11-20)

Before this change, one approved "Open a screen" card gave Buddgy a yes for every screen and flow for the rest of the app session. "Set up a budget" could then open the Budget Builder silently, behind the still-open chat.

- **The yes is per chat and per place:** tool plus target, so "Open Debts" never covers "Goals" or the Budget Builder. New chat and sign-out forget them all.
- **The budget setup always asks.** It's a flow, so it shows a card titled "Open the Budget Builder" with the target "Budget Builder", every time, even with an earlier yes.
- **The chat closes first.** Opening a screen, a setting or the budget setup closes the chat before navigating, so nothing opens behind it. The conversation stays and reopens from the orb.
- **The model offers, the app asks:** the system prompt now says this.
- **Not done yet:**
  - "Build it here", the second choice on the budget card, comes with plan item 2.1.
  - Explicit "open X" requests running at once without a card is left out. A yes per place covers repeats; add the lexicon rule if the extra tap bothers people.

| Item | Files | Status |
|---|---|---|
| A yes per place, flows always ask | `navConsent.ts`, `exec/navigation.ts`, `runTurn.ts`, `useBuddgyChat.ts`, `copy.ts`, `prompt.ts` | **Automated verification** (runner job 7): a new case in `runTurn.test.ts`; consent calls updated in `runTurn.test.ts` and `injectionGolden.test.ts` |
| The chat closes before a page opens | `exec/navigation.ts` | **Manual verification required** (ask "open my debts", approve; the chat closes and Debts shows) |

## Step 7: BDG-003, a flipped card never shows its front mirrored on the back (2026-11-20)

All four flipping cards (Guest pass, Pro member, Letterpress tier, Founder) share `FlipCardRig`, so one change covers them. The cause, from the finding: WebKit doesn't honour the hide-the-back rule on the wrapper, so the turned-away face is painted mirrored over the visible one.

- **The rig hides the turned-away face itself.** `rigFrame` now reports `showBack` (flip past 90°), and `paint()` sets `visibility: hidden` on the face turned away. This works on every engine, including with reduced motion.
- **Belt and braces:**
  - The hide-the-back rule is also on the painted `.face`, as in the original mockup.
  - Each side gets its own 3D layer (`translateZ(0)`).
  - The locked-tier dim filter moved from `.slot` to `.face`, so it no longer sits on the element that hides its back.

| Item | Files | Status |
|---|---|---|
| One face at a time, switching at 90 degrees | `flipPhysics.ts`, `FlipCardRig.tsx`, `cards.module.css` | Unit test written, **not yet run** (`membershipComponents.test.tsx`) |
| The back on an iPhone | | **Native verification required** (flip the invite, Pro, rewards and founder cards; the back shows only back text) |

## Step 8: Claude-style chats (BDG-013, owner ruling; spec `claude-style-chats.md`)

Buddgy chats now work like ChatGPT and Claude, inside the same pop-up.

- **Chats are kept.** The current chat and up to 50 earlier ones are kept on this phone. Opening Buddgy shows the last chat and continues it, even after the app was closed. The 30-minute reset is gone from the phone.
- **The chat list:** a new button in the header opens it. It has New chat, search, groups (Today / Yesterday / Previous 7 days / Older), open, delete with a confirm, and a Memory row that opens the existing Memories setting.
- **Delete removes the chat and its context.** The context exists only in the saved transcript on this phone.
- **After a restart:** a waiting change becomes Out of date and can't be applied twice, and a reply cut off mid-stream becomes a failed reply with Retry. Opening a chat doesn't move it up the list.
- **Privacy:** saved on the phone only. Wiped on sign-out and when another account signs in. Never synced.
- **Writes:** only once a reply has landed, never per streamed token.
- **Server (migration 0340, applied):** `ai_idle_minutes` is 30 days on every plan, so a reopened chat continues on the same server chat. A chat still rolls at its turn or spend cap, carrying the recap.
- **Usage:** what the model gets is unchanged, the last few turns plus a recap. Installed builds keep resetting on the phone after 30 minutes and are unaffected.

| Item | Files | Status |
|---|---|---|
| Server: chats continue | `supabase/migrations/0340_ai_chats_continue.sql` | Proven on live in a rolled-back transaction (a chat idle 2 hours continued: same chat, `new_chat` false), then applied. All 3 plans show 43200. |
| Saved chats, restore, caps, groups, search, account wipe | `savedChats.ts`, `useBuddgyChats.ts`, `useBuddgyChat.ts`, `clearBudgetData.ts` | Unit tests written, **not yet run** (`savedChats.test.ts`) |
| Chat list in the pop-up | `AIChatList.tsx`, `AIChat.tsx`, `AIChatHeader.tsx` (optional `onShowChats`, default unchanged), `buddgyChatCopy.ts` | **Manual verification required** (list, search, open, delete, Memory, reopen after closing the app) |
