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
| One face at a time, switching at 90 degrees | `flipPhysics.ts`, `FlipCardRig.tsx`, `cards.module.css` | **Automated verification** (runner jobs 9–11; `membershipComponents.test.tsx`) |
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
| Saved chats, restore, caps, groups, search, account wipe | `savedChats.ts`, `useBuddgyChats.ts`, `useBuddgyChat.ts`, `clearBudgetData.ts` | **Automated verification** (runner jobs 9–11; `savedChats.test.ts`) |
| Chat list in the pop-up | `AIChatList.tsx`, `AIChat.tsx`, `AIChatHeader.tsx` (optional `onShowChats`, default unchanged), `buddgyChatCopy.ts` | **Manual verification required** (list, search, open, delete, Memory, reopen after closing the app) |

## Step 10: streak from join week (owner-approved design `S9-Final12Weeks`)

**Launch clamp (follow-up):** week 1 is the later of the sign-up week and the week loyalty launched (`LOYALTY_START = '2026-11-17'` in `rewardsState.ts`, the day migrations 0306-0314 went live; no earlier constant existed). Every current tester joined earlier and starts at week 1 in the launch week, so the strip never shows weeks from before rewards existed. The caption still says "since you joined" for them.

- **Join week:** taken from `user.created_at`, clamped to `LOYALTY_START` (the auth user, already read on this page for "Since"). It is turned into a local date and measured against the server's week grid: the last `streak.weeks[].week` is this week's local start (`user_settings.week_start_day`). The server's `'before'` state does not mark the join week, because it counts from the first kept week. `loyalty_week_summary` carries no join data. The local date uses the device time zone, not `user_settings.timezone`, so a sign-up within hours of midnight on a week boundary can be one week off.
- **Strip:** week 1 sits first and the strip fills left to right. Weeks not reached yet are dashed outlines. Weeks before the join never show, including a seasonal freeze or last week during the grace days. From week 13 on it shows the latest 12. Kept, frozen, missed and this week (ringed) look as before.
- **Caption:** one line under the strip: "Week 1 · since you joined", "Weeks 1–3 · since you joined", "Weeks 3–14 · you joined in week 1" (en and ar). The spoken summary uses the same range and counts only the weeks shown.
- **Week numbers inside cells:** not drawn. They do not fit beside the flame or snowflake glyph without a second row, which the design had and which would add about 16px.
- **Height:** +20px (4px gap plus one 16px caption line). No new card or heading.
- **Component:** `HotStreakCard` changes are additive. It gains the `future` week kind and an optional `caption`, and the default render is unchanged (the gallery and existing tests still use it as before).

| Item | Files | Status |
|---|---|---|
| Strip logic and week number from join date | `rewardsState.ts` (`weekSinceJoin`, `streakStrip`), `RewardsView.tsx` | Unit tests written in `rewardsState.test.ts` for: joined this week, week 3, week 9 with a freeze, week 14 showing 3–14, a missed week, pre-join weeks hidden, and the week-boundary dates, a September sign-up clamped to the launch week. **Not yet run** (cloud runner). |
| Dashed cells and caption | `HotStreakCard.tsx`, `membership.module.css`, `rewardsCopy.ts` | **Automated verification** (runner jobs 10–11). **Manual verification required**: look in en and ar, height. |

## Step 9: card faces (owner-approved design "0 · Final cards in the app")

- **Looks:** two styles, Metal (brushed, engraved type, steel chip, `•••• 4821`) and Bank-issued (printed guilloche lines, gold chip, contactless mark, `•••• •••• •••• 4821`), in 16 named themes. The stops and ink match the C4 palette board. The free colour picker is gone.
- **Mini card:** exactly 88×56 with radius 7. Per the owner: the bank's short name is on the left, the localized card type on the right, and the chip and `••last4` are below. Used in the account card strip, the dashed add slot and the +N tile (both 56 tall), and the expense sheet's "Paid with" trigger (72px row, two-line name).
- **Large face:** drawn at 340×214 with radius 13 and scaled: 252 in the carousel (wallet, picker, account detail, installment picker), 280 in the setup preview with the theme halo.
- **Abbreviation (`bankAbbreviation`):** a catalogue match is abbreviated from its catalogue name ("National Bank of Egypt" gives NBE). A first word already in capitals of at most 4 letters is kept (CIB, NBE, QNB, HSBC). Otherwise each word gives its initial and a capitalised word gives itself: Banque Misr is BM, Emirates NBD is ENBD. Stop-words are skipped, and a single word is kept up to 4 letters, else its first 3. The maximum is 4; Arabic names keep their first word. A card under an account takes its parent's bank.
- **Storage (migration 0341, applied):** two nullable columns, `payment_methods.card_style` ('metal' | 'bank') and `card_theme`. `color` stays a real hex, because avatars, tints and installed builds read it, and the app writes the theme's first stop into it.
- **Older cards:** a card with no theme (or an unknown one) is drawn in the theme nearest its colour, style Bank-issued, so no card renders blank.
- **Editing keeps the colour:** editing a method keeps its saved `color` until the user picks a theme, so an account's avatar does not shift colour after a label edit.
- **Differences from the mockup:**
  - The expense sheet has no "Recent" cards row (no recency data exists today).
  - The network box shows only when the card's name states a network (VISA, MASTERCARD), never the literal "NETWORK".
  - The bottom-left line is the card's label (or the currency when the top-right holds ⋯ or the check), not a cardholder name.
  - The ⋯ button is unscaled at 32px with a 44px tap area.
  - The Paid with row keeps the FieldButton border and prints `•• 4821`.
  - Income and debt pickers keep the old trigger (the card trigger is the additive `variant="card"`).
  - Style and theme controls also show when editing a bank account or wallet in this sheet.
  - A 4-letter abbreviation beside PREPAID or a long Arabic type truncates the type on the mini card.

| Item | Files | Status |
|---|---|---|
| Themes, contrast, nearest-theme mapping, abbreviation | `src/lib/payment/cardThemes.ts`, `cardThemes.test.ts` | **Automated verification** (runner jobs 10–11): all 16 themes ≥4.5:1 on both stops (lowest is copper at 4.96, checked by hand), old colours map, abbreviation table and max length. |
| Mini card layout (abbreviation left, type right, ••last4, 88×56) | `CardFaceChip.tsx`, `CardStrip.tsx`, `AccountRow.tsx`, `accounts.render.test.ts` | **Automated verification** (runner jobs 10–11). **Manual verification required**: look in en and ar. |
| Storage | `0341_payment_method_card_look.sql`, `database.types.ts`, `paymentMethodMapper.ts`, `types.ts` | Applied on live; both columns are nullable, `authenticated` can select and update them, `anon` cannot. `sync_pull` sends whole rows (`to_jsonb`), so the new columns sync. |
| Large face, carousel, setup sheet (Metal \| Bank-issued + 16-theme picker), Paid with | `CardFace.tsx`, `CardThemePicker.tsx`, `PaymentCardCarousel.tsx`, `PaymentMethodSetupSheet.tsx`, `PaymentMethodPicker.tsx` (additive `variant="card"`), `ExpenseSheetForm.tsx`, i18n | **Manual verification required** (screenshot from the cloud runner). **Native verification required**: the faces in the iOS/Android WebView. |

## Step 11: Buddgy action cards (owner-approved canvas "Every Buddgy action" and "Card components")

- **Contract (`src/lib/buddgy/tools/proposal.ts`):** all of these are optional, so every existing proposal still builds.
  - `PreviewModel` gains `pattern` (`record | batch | create | change | move | remove | status | go`).
  - Record and move: `amount`, `currency` and `what`. Move also has `from` / `to`, each `{ name, color?, now?, after? }`.
  - `methodRef`: the method the pay-with strip rings.
  - Create: `entity`, plus `card` (enough of a method to draw its face).
  - `missing` and `guessed`: field keys.
  - Batch: `items[]`, each `{ key, proposal }`.
  - `PreviewRow` gains `key`, so a body that draws an arg its own way can skip that row.
- **Pattern derivation (`tools/pattern.ts`):** `patternOf` uses the tool's own `pattern`, else `derivePattern(name)`.
  - The rule is a name table first, then prefixes (`delete_` / `forget_` / `cancel_` / `clear_` give remove, `add_` gives create), then tone, else change.
  - Risk does not decide it: `activate_budget_plan` is `strong` but is a status card, and `cancel_subscription` is `approve` but is a remove card.
  - `remember` is a create card (it is not in the spec table).
  - `add_income` sets its own pattern: create for a recurring source, record for money received once.
  - All 51 write and nav tools map.
- **Tools enriched:**
  - `add_expense`: record fields, row keys, `missing: ['method']` when no method was named and more than one exists, and `guessed: ['category']`.
    - The default method stays as the ringed guess. Risk and the written expense are unchanged.
    - An unnamed method is no longer stored in the args, so the question stays open after another field is edited, and apply resolves the same default.
    - The category guess mark clears after any edit, because the args store the resolved category.
  - `add_income`: keyed rows, so the record body draws its date as a picker line.
  - `transfer_between_pockets` and `withdraw_from_savings`: from/to with balances now and after.
  - `add_payment_method` and `add_credit_card`: a card face.
  - Every other tool renders through derivation, with the facts its rows already carry.
- **Batch (`tools/batch.ts`):**
  - Two or more `add_expense` proposals in one reply group into one card in `finishWithProposals`. This runs before the auto pass, so rows never auto-apply one by one, and it covers both the local quick add and model turns.
  - The batch is not a tool, so the model never sees it.
  - Removing a row rebuilds the card, so the count, the total and the saved chat agree.
  - Apply writes the rows in order. The store has no transaction, so a failing row takes back the rows already written, and Try again cannot double them.
  - One Undo takes back every row.
  - The model's history notes name the rows.
- **Hook (`useBuddgyChat`):**
  - apply dispatches the batch.
  - `reviseProposal` takes an optional `rowKey`.
  - New `removeBatchRow`.
  - New `retryProposal`, for Try again on "Couldn't apply".
- **UI (`src/components/features/ai-chat/cards/`):**
  - The shell is `BuddgyActionCard`. `AfterState` covers Done + Undo, Undone, Skipped, Out of date, and Couldn't apply + Try again, with the same statuses and copy keys.
  - `EditFields` is the old edit form, moved here.
  - `QuestionField` asks a missing field with the control that fits it.
  - There are eight bodies, plus `RecordPickers`.
  - Pickers:
    - `PayWith`: `CardFaceChip` 88×56 mini cards plus Cash, the guess ringed, and Other opening `SelectPaymentMethodSheet`.
    - `CategoryPick`: `CategoryGlyph` chips, top 5 by use, then More.
    - `DatePick`: Today, Yesterday, and Pick a date opening `UnifiedDatePicker`.
    - `AccountPick`: `SelectableCard` and `BrandMark`.
  - Sheets mount only when opened.
  - Reused: `Button`, `IconButton`, `OptionChip`, `SelectableCard`, `Badge`, `FactsTable`, `AmountField`, `Input`, `ProgressRing`, `BrandMark`, `CardFaceChip`, `CardFace` (create preview at 0.6 scale).
- **Copy:** `src/lib/i18n/buddgyCardCopy.ts` (en and ar). CTA verbs include "Add expense", "Add 3 expenses" (counting down to "Nothing to add"), "Move EGP 2,000", "Add card", "Pause", "Yes, cancel it" and "Keep it". Where nothing more specific fits, the label falls back to the chat's `approveRisk`.
- **Differences from the mockups:**
  - **Record lines:** Paid with is also a line that opens its strip; it starts open only when the method is missing. The mockup shows the strip open, with no line. Picker lines appear only for a tool that keys its rows (`add_expense`, one-time `add_income`); the other record tools show their facts under the amount.
  - **Pay-with tiles:** 96×84. The mini card is 88×56 per the approved code, where the mockup tile holds a 70×44 face. The strip caps at 6 tiles plus Other.
  - **"Paid with?" is not a blocker:** the card applies with the ringed guess, as today. The mockup's "Needed to add it" is shown, but the primary button stays enabled.
  - **Create preview:** the card face, or a `BrandMark` with the first row's name, or a 0% `ProgressRing` for a goal. There is no `AccountRow` preview for a new account: `AccountRow` needs a balance view the proposal does not have.
  - **Create questions:** no tool emits `missing` for a create field yet. The mockup's questions ("Which account pays it off?", the SMS toggle, "How will you pay it back?") have no tool argument behind them. No model-facing params were added; `QuestionField` is ready for when they exist.
  - **Remove and status:** the item is drawn as facts rows, not a `BrandMark` row (proposals carry no brand colour). There is no "undo for 10 seconds" note; Undo stays on the Done line where the tool returns one.
  - **Move:** the `via` line ("InstaPay · counts toward…") is not shown. The goal note stays in the effect line.
  - **Change:** the meta month in the head is not shown.
  - **Go:** a nav card shows only when moving needs a yes (BDG-015, unchanged). Plain navigation still acts with no card.
  - **E2E journey:** `g-buddgy` now accepts "Add expense" as the approve label.

| Item | Files | Status |
|---|---|---|
| Pattern derivation for every write tool | `tools/pattern.ts`, `__tests__/pattern.test.ts` | **Automated verification (runner job 14)**: every write and nav tool in `TOOLS` gets its expected pattern, risk does not decide it, unknown tools fall back, saved proposals derive. |
| Record, move and create fields on tools | `exec/expenses.ts`, `income.ts`, `savings.ts`, `payments.ts`, `debts.ts`, `__tests__/batch.test.ts`, `income.test.ts`, `savings.test.ts` | **Automated verification (runner job 14)** |
| Batch: grouping, remove a row (count, total, CTA), apply all, undo all, roll back on failure, stale on restore | `tools/batch.ts`, `useBuddgyChat.ts`, `__tests__/batch.test.ts` | **Automated verification (runner job 14)** for the pure functions. The hook wiring (apply, revise by row, remove, Try again) has no automated test. |
| Picker revises the proposal (method answers `missing`, category, date, a batch row keeps its key) | `__tests__/batch.test.ts` | **Automated verification (runner job 14)** through `reviseProposalArgs` and `replaceBatchItem`. Taps are not covered (node render tests only). |
| Shell, eight bodies, after states | `cards/**`, `ProposalCard.tsx`, `cards/actionCards.render.test.tsx` | **Automated verification (runner job 14)**: one static render per pattern, plus each after state. **Manual verification required**: the look against the mockups in en and ar, light and dark, picker taps, the Other sheet, Pick a date. |
| Pay-with strip, sheets over the chat | `pickers/PayWith.tsx`, `DatePick.tsx` | **Native verification required**: the sheet stacking above the chat panel, and the horizontal strip scroll in the iOS and Android WebView. |

## Step 12: budget in chat (2.1) (owner-approved canvas "Building a plan in the chat")

- **Builder in production:** `StudioPage`, opened by `useBudgetTakeover` on `/budget-setup`. The v5 prototype is not touched.
- **Choice card:** `start_budget_setup` now has its own card pattern, `plan`, with the body `PlanStartBody`. It offers "Build it here with me" and "Open the budget builder" (today's apply: the chat closes, then `/budget-setup` opens the studio), plus the cost line. No local intent offer was added: the model calling `start_budget_setup` is the only entry.
- **Storage:** `SavedChat.plan?: ChatPlan`, shaped `{ v: 3, base: FlowState, screens: { answers: ScreenAnswer[], itemIds: string[] }[], status: 'asking' | 'paused' | 'ready' | 'handed', savedAt }`.
  - The live flow is never stored. It is replayed from `base` through `applyScreen`, the reducer that `StudioPage.submit` now uses too.
  - Questions and answers go into the chat as ordinary `buddgy` and `user` items. Search, titles and restore work unchanged, and the model sees the answers as context on a later turn.
  - A plan from another question set, or one left for more than seven days, is dropped when the chat is reopened.
- **Questions:** each one is the builder's own `ScreenStep`, with an additive `compact` prop that replaces the page heading with a plain title and reason. Grouped fields, defaults, "Not sure" and Continue all work as in the builder.
  - Back takes away the last screen and its two bubbles.
  - Pause hands the composer back to normal chat, and "Continue the plan" resumes.
  - "Good enough, build now" shows when the builder would show it.
- **Typed answers:** while a question waits, `send()` routes the text to `typedAnswer` before the quick-add path and `runTurn`. `parseTyped` reads amount, stepper, slider, toggle or confirm (yes and no, in en and ar), chips and multi (by label), with no model call. An unreadable reply keeps the question and says so under the card. Retry never re-sends an answer.
- **Ready:** `PlanReadyCard` shows the engine's draft: `studioFacts` and `engineDraft`, the same helpers the studio's build now calls. It shows income, a split by the three chapters, the four biggest lines and the rest, "Review and save in the builder", and "Change an answer" (which is Back).
- **Hand-over:** `requestBudgetStudio(handover?: FlowState)` sets `budgetStudioHandover`, which is not persisted.
  - The takeover passes it to `StudioPage` as `handover`. The studio starts on that state with `opener: 'done'` and `buildNow` true.
  - The studio writes the profile answers once on arrival, because the chat never does. It then runs its normal build: entities, engine, `/api/budget/ai` charged as `budget`, and a draft plan. After that it opens review.
  - The chat marks the plan `handed`, so a second tap can never build twice. A handed plan shows only "Opened in the builder"; its preview is not recomputed, because the builder's new records would be counted twice.
  - The studio's first save replaces any unfinished builder draft that has no intent, the same as starting the builder fresh.
- **Copy:** `src/lib/i18n/buddgyPlanCopy.ts` (en, ar). Question wording comes from the builder's own copy.

**Differences from the mockups**
- Question cards use the builder's controls (`SelectableCard` rows for short option lists, `OptionChip` for long ones), not chips everywhere. Confirm questions are the builder's "What I found" screen with its segmented control, not two buttons.
- The progress count comes from the screens still pending, so it changes as answers unlock or close questions. The choice card says "A few quick questions", not "About 8".
- The ready card splits by the plan's three chapters (Must pay, Everyday, Saving), not Needs, Wants and Saving. Its numbers come from the engine before the AI refinement, so review can differ slightly.
- The card shows the engine's own line names. There is no sentence like "EGP 2,000 a month toward the car".
- "Nothing is saved until you review it in the builder" is true of the chat, which writes nothing. In the builder, the build writes the profile answers and creates the income, debt, goal and savings records before review, as it does today. **The owner may want this line reworded.**
- The cost line keeps the approved text, "not your chat usage". Per the plan's cost facts, a budget build draws from the same AI credits under its own feature tag. **The owner may want this line reworded.**
- The progress strip sits under the chat header, and the composer placeholder becomes "Or type your answer". The header keeps its chat title.

| Item | Files | Status |
|---|---|---|
| Chat flow gives the builder's answers, skips, cursor, facts and engine draft for the same inputs | `buddgy/plan/chatPlan.ts`, `planTurns.ts`, `budget/flow/flow.ts` (`applyScreen`), `budget/studioPreview.ts`, `buddgy/plan/__tests__/chatPlan.test.ts` | **Automated verification (runner job 14)**: written, not run on the Mac. |
| Typed answers for each control, en and ar | `buddgy/plan/parseTyped.ts`, `__tests__/parseTyped.test.ts` | **Automated verification (runner job 14)** |
| Resume mid-flow from a saved chat (JSON round trip, same next question), stale or old-version plan dropped | `client/savedChats.ts`, `useBuddgyChat.ts`, `chatPlan.test.ts` | **Automated verification (runner job 14)** for the pure part. The hook's reopen wiring has no automated test. |
| Hand-over state the builder reads, not persisted, one-shot | `useSettingsStore.ts`, `useBudgetTakeover.ts`, `StudioPage.tsx`, `chatPlan.test.ts` | **Automated verification (runner job 14)** for the store contract. **Manual verification required**: landing on the building screen, then review, from the chat. |
| No turn, network or AI build during the questions | `chatPlan.test.ts` (`runTurn`, `apiFetchAuth`, `refineDraft` mocked and asserted untouched), `routesToPlan` | **Automated verification (runner job 14)** at the routing and flow level. The routing inside `useBuddgyChat.send` is not covered: there is no hook harness. |
| Choice card, progress strip, question, paused, ready and handed cards | `ai-chat/plan/*`, `ProposalCard.tsx`, `plan.render.test.tsx`, `pattern.test.ts` | **Automated verification (runner job 14)**: static renders. **Manual verification required**: the look against the mockups in en and ar, light and dark, and the keyboard over the composer. |
| Journey: answer in chat, land on review with the same numbers | none | Not written. A Playwright case in `e2e/journeys` is still to do; it needs the model to call `start_budget_setup`, or a seeded chat. |

## Step 13: 1.1b chat error-rate alert

- **Why:** the quick tier (`gemini-2.5-flash-lite`) logged only `error` on chat from 19 Oct to 16 Nov, 33 calls over about 4 weeks, and nothing watched it.
- **Migration `0342_ai_chat_error_alert.sql`** (applied to `tzioppxwsljhlglyducm` with `execute_sql`):
  - partial index `ai_usage_events_chat_created_idx (created_at) INCLUDE (model, status) WHERE feature IN ('chat','chat_hop')`;
  - table `ai_model_alerts` with `UNIQUE (model, alert_date)`, RLS on, nothing for anon or authenticated, and 180-day retention inside the check;
  - setting `ai_chat_error_alert` = `{"maxErrorShare": 0.25, "minCalls": 10, "allFailedMinCalls": 3}`, with the same defaults when the key or a field is missing;
  - `ai_chat_error_check()`, SECURITY DEFINER, `EXECUTE` for `service_role` only: one set-based `INSERT ... SELECT ... GROUP BY model ... ON CONFLICT DO NOTHING` over the last 24 hours;
  - pg_cron `ai-chat-error-check` daily at 06:05 UTC.
- **Failed** = `error` + `aborted_empty`. A stalled upstream lands in `aborted_empty` (`turn.ts`), and so does a user Stop before any text. `ok` and `aborted` count as healthy.
- **Delivery:** the admin Overview's "Needs attention" list shows one line per model from the last 7 days (newest day), and links to AI cost. Email was not used: sending runs in Node through Resend with no SQL-side queue, and system sends fail on this project with "RESEND_API_KEY is not set". `integration_outbox` is ticket-shaped and has never sent a row. **Residual risk:** the portal is a pull channel, so someone has to open the Overview.
- **Live proof (rolled back):** the whole migration except the cron line, plus synthetic rows, ran in one transaction that ended in `RAISE EXCEPTION`. The synthetic rows were `qa-synth-all-fail` (3 of 3 `error`), `qa-synth-share` (4 of 12), `qa-synth-healthy` (2 of 12) and `qa-synth-not-chat` (5 sms errors). Result: `run1=2 run2=0`, with alert rows `all_failed 3/3` and `share 12/4/0.3333`. Afterwards the table and index did not exist and no synthetic rows were left.
- **Backtest** of the rule at 06:05 UTC each day, 15 Oct to 21 Nov: it trips only `gemini-2.5-flash-lite`, on 20 Oct (3/3), 2 Nov, 9 Nov, 11 Nov (12/12) and 14 Nov. No other model trips.
- **EXPLAIN** (358 rows today, so the planner seq-scans either way):
  - before, natural: `Seq Scan on ai_usage_events`;
  - before, `enable_seqscan=off`: `Bitmap Index Scan on ai_usage_events_user_cover_idx` with a `created_at` condition on the non-leading column, which reads the whole index;
  - after, `enable_seqscan=off`: `Index Only Scan using ai_usage_events_chat_created_idx`, `Index Cond: created_at >= now() - 24h`.
- `get_advisors` (security): the only new finding is INFO "RLS enabled, no policy" on `ai_model_alerts`, which is intended and the same as every other admin table.

| Item | Files | Status |
|---|---|---|
| Check function, thresholds from settings, service_role only, one alert per model per day | `supabase/migrations/0342_ai_chat_error_alert.sql`, `src/lib/server/__tests__/sqlContracts.test.ts` | **Automated verification**: live rolled-back proof done; the contract tests are written but not run (cloud runner). |
| Daily cron, frequency rule, `SCHEDULED_JOBS.md` row | `docs/SCHEDULED_JOBS.md`, `src/lib/server/__tests__/cronGuardrails.test.ts` | **Automated verification**: written, not run (cloud runner). Job live in `cron.job`. |
| Overview "Needs attention" line | `src/app/api/admin/overview/route.ts`, `views/OverviewView.tsx`, `aiModelAlertDisplay.ts` (+ `.test.ts`), `database.types.ts` | Unit test written, not run. **Manual verification required**: the line in the portal (no alert exists yet, so it shows once a model trips). |
| Owner email or push | none | **Blocked**: no SQL-side email queue, and `RESEND_API_KEY` is not set for system sends. |

## Step 14: swipe back (BDG-017)

- **Owner ruling:** swipe to go back everywhere, no UI change, no header back buttons.
- **Path chosen: a JS left-edge swipe, iOS only. WKWebView's `allowsBackForwardNavigationGestures` stays off.** The shell does push real history entries (`navigate()` calls `pushState`, `bindPopState` handles pop), so the native gesture would fire. It still fails three of the goals:
  - WebKit pops history before the back guards can close an open sheet;
  - it goes back from tab roots, because the history trail includes tab hops;
  - it has no Flow fallback when there is no history.
- **One back action:** `goBack()` (`src/lib/navigation/goBack.ts`) is now shared by the Android `backButton` handler and the iOS swipe.
  - **Both platforms:** back guards run first (LIFO registry; sheets close through `ModalShell`'s guard), then the active modal closes.
  - **Android:** unchanged. A non-root screen goes `history.back()`, or `/` when there is no history; `/` hands over to the press-again-to-exit toast.
  - **iOS:** nothing happens under an overlay that holds the scroll lock without a guard, or on a tab root (`/`, `/flow`, `/expenses`, `/income`, `/accounts`, `/wealth`, `/savings`, `/investment`, `/debts`). Otherwise it goes `history.back()`, and with no history `navigate('/flow', { replace: true })`. It never leaves the app.
- **Gesture** (`src/lib/navigation/edgeSwipe.ts`, mounted by `EdgeSwipeBack` in `AppShell`):
  - starts within 20 pt of the leading edge and commits on release after 60 pt of mostly horizontal travel;
  - is cancelled early by a vertical or wrong-way move;
  - ignores touches that start on the Buddgy orb (`data-no-ptr`), inputs, sliders, a sheet's drag strip (`touch-none`), a horizontal scroller with content to scroll, or a finger-driven carousel (`touch-action: pan-y` on an element that does not scroll vertically, as `PaymentCardCarousel` sets). A `ModalShell` body is `pan-y` but scrolls vertically, so a swipe there still reaches the back guards;
  - mirrors to the right edge when `<html dir="rtl">`. The i18n provider pins `dir="ltr"` today, so this branch is dormant;
  - uses passive listeners only, so pull-to-refresh and scrolling are untouched.
- **iOS has no `canGoBack`:** `navStore` counts shell pushes since the document loaded, with `popstate` taking one off. An undercount only sends a back to Flow.
- **Android system back gesture:** Capacitor delivers it as `backButton`, the same event as the hardware key. `MainActivity` and the manifest override nothing, so it keeps working through `goBack('android')`.
- **No native change, no Swift edit:** it ships with the web bundle.

| Item | Files | Status |
|---|---|---|
| Gesture decision: start zone, 60 pt threshold, vertical and wrong-way rejection, RTL mirror, ignored targets | `src/lib/navigation/edgeSwipe.ts`, `edgeSwipe.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Back action: guard first, modal, unguarded overlay, tab-root no-op, history, no-history to Flow; Android order unchanged | `src/lib/navigation/goBack.ts`, `edgeSwipe.test.ts`, `navStore.ts`, `navigate.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Android handler moved onto `goBack('android')` | `src/components/layout/AppShell.tsx` | **Native verification required**: hardware back and the system back gesture on a device (sheet closes first, inner screen goes back, exit toast on `/`). |
| Swipe feel on iPhone: edge pickup, no clash with carousels, PlanDeck, PaydayTimeline or the orb, sheet closes first | `src/components/layout/EdgeSwipeBack.tsx` | **Native verification required** (needs a native build; none was run). There is no slide animation by design, since the owner asked for no UI change. Multi-step screens with no back guard (for example `/start`) leave the screen on a swipe instead of stepping back one step, the same as Android back today. |

## Step 15: pocket picker (BDG-026-028)

- **Owner ruling:** the pocket select reuses the existing provider picker component, showing pockets.
- **Additive variant of `ProviderPickerSheet`:** `items` (id, name, subtitle, glyph, trailing), `title`, `searchPlaceholder` and `customLabel`, with `onCustom` and `popularIds` now optional.
  - With `items`, the sheet lists those options with search over name and subtitle, in a `radiogroup`, with no Popular/All sections.
  - The CTA shows only when `onCustom` is given.
  - Without `items` the catalogue mode is byte-for-byte the same path, and the three existing callers are unchanged.
- **`PocketPickerField`** (in `MoneySheetParts`) replaces `PocketRadioList` (removed, no other callers) for Add money "Into" and Withdraw "From".
  - It is one `FieldButton` row with the chosen pocket's colour tile, name, identity and balance, labelled for screen readers as "Into: <pocket>".
  - It opens the picker with every pocket and its balance, so the amount stays near the top of the sheet.
- **Add pocket** (Add money only, as the owner asked) opens the existing `AddHoldingSheet` with an additive `pocketOnly` prop that hides the Investment tab.
  - It is a sibling sheet above Add money, so the typed amount survives.
  - `PocketFormSheet` gains an optional `onCreated(id, currency)`, and `AddHoldingSheet` an optional `onPocketCreated`. The new pocket is selected and its currency taken from the callback, because the `pockets` prop is one render behind (`pocketCurrency`).
- **Strings:** `searchPockets` and `addPocket` added in en and ar.
- **Journey suite:** a shared `pickPocket` helper (`e2e/journeys/lib/ui.ts`) picks Into and From through the picker in `d-pockets.spec.ts` (D) and `round2/r1-core.spec.ts`. Q3 in `q-quick-add.spec.ts` asserts the preselected Into field instead of clicking a pocket card. A new case, D3, covers Add pocket from Add money: the amount is kept, the new pocket is selected, and the deposit is saved. It is listed in `e2e/README.md`.
- **Left as is:** Withdraw's "Move to" pocket choice stays a compact horizontal chip row. The picker keeps its search text between opens, as the provider mode already does.

| Item | Files | Status |
|---|---|---|
| Variant renders pockets (name, balance, glyph, search, Add pocket); provider mode unchanged | `ProviderPickerSheet.tsx`, `ProviderPickerSheet.pockets.render.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Picking a pocket sets the form value; Add pocket calls the add flow; no Add pocket on Withdraw | `MoneySheetParts.tsx`, `PocketPickerField.render.test.ts`, `selectedPocket.ts` (+ test) | **Automated verification (runner job pending)** at the prop-wiring and pure-logic level. Vitest here is node-only, so the state changes inside the sheet are covered by journey D3. |
| Add pocket opens the existing flow and returns to Add money with the amount kept and the new pocket selected | `AddSavingsSheetV3.tsx`, `AddHoldingSheet.tsx`, `PocketFormSheet.tsx`, `e2e/journeys/specs/d-pockets.spec.ts` (D3) | **Automated verification (runner job pending)**: journey written, not run. The runner job should cover `d-pockets` (D, D2, D3), `q-quick-add` Q3 and `round2/r1-core`. |
| Look of the field row and picker in en and ar, light and dark; the numpad if it is open when Add pocket is tapped | same | **Manual verification required**. |

## Step 17: setup bar and Privacy & lock (BDG-002, BDG-023)

Owner-approved canvas: `S002-after`, `S002-sheet`, `S023-hub-after`, `S023-screen-after`.

**BDG-002, setup bar.** The owner ruled that the bar counts setup steps, not profile completion.
- The 3px unlabelled bar under the Settings profile row is now one 44px row: "Finish setup · 3 of 5", a 4px progress line (96px wide) and a chevron. It is hidden once setup is complete, as before.
- Tapping it opens the existing `SetupChecklistSheet`, the same sheet the profile menu opens.
- `computeSetupSteps` takes a new `smsAvailable` input, and `useSetupProgress` passes `isNative()`. The SMS step only counts in the iOS and Android apps. On the web, where capture cannot run, the count reads "of 4" and can reach 100%. A synced SMS intent on the web no longer counts.
- The header ring, the profile menu row, the checklist and Flow's setup card all read the same hook, so they all count the same steps.
- The copy reuses `t.setup.chipLabel` and `t.setup.progress`. No dictionary change.

**BDG-023, Privacy & lock.** The owner chose option C, a new screen.
- New screen `/settings/privacy`: a "Lock" section with the biometric sign-in and app lock switches and a note under it, then "Hide balances" (`BalancePrivacyCard`). It is registered in `SHELL_PATHS` and `AppViewRouter`, and signed-out users are redirected like on the security screen.
- The Lock section shows only in the app, because both switches render nothing on the web.
- Sign-in & security keeps email, password, two-step, devices and Delete account.
- The hub's Privacy & data group is now `PrivacyRows`:
  - Sign-in & security, subtitle "Password, two-step, devices".
  - Privacy & lock, subtitle "Face ID, app lock, hidden balances", signed in only.
  - Data & backup, subtitle "Export, restore, not counted", for everyone.
- Registry: `biometric` and `appLock` moved to the new group `privacy` ("Privacy & lock") and route `/settings/privacy`. The ids are unchanged, so search, `useOpenSetting` and Buddgy's `open_setting` reach the new screen. The `data-setting-id` wrappers moved with the switches, so the arrival highlight still works.
- Copy in en and ar is in `settingsHubCopy.ts`.

| Item | Files | Status |
|---|---|---|
| Step count per platform (5 with SMS, 4 without, synced intent ignored without the step) | `src/hooks/useSetupProgress.ts`, `useSetupProgress.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Registry: both switches on the new screen and group, account controls stay, every id resolves, Buddgy can still open both, search finds them | `src/lib/settings/registry.ts`, `registry.test.ts`, `shellRoutes.ts`, `AppViewRouter.tsx`, `groupMeta.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Hub rows and subtitles, signed in and signed out | `hub/PrivacyRows.tsx`, `PrivacyRows.test.tsx`, `settings/page.tsx` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Look of the setup row, the sheet it opens, the hub rows and the Privacy & lock screen in en and ar, light and dark | `ProfileBanner.tsx`, `settings/privacy/page.tsx`, `security/page.tsx`, `SecurityCard.tsx` | **Manual verification required** (runner screenshot, then owner review). |
| Biometric and app lock switches working on the new screen; the search highlight landing on them | `settings/privacy/page.tsx` | **Native verification required**. |

Differences from the boards:
- The checklist sheet is unchanged. It has no "Steps for this phone" line, its bar is the shared `Progress` (4px, not 8px), and its title shows in both the sheet header and the card.
- The Face ID and app lock rows are the existing `bare` toggles, which have an inline icon rather than the board's tinted chip.
- The lock note says "Face ID or fingerprint" so that it is also true on Android.
- There is no "NEW" tag on the hub row (the board marks it optional).
- Hide balances has no setting id, so search and Buddgy cannot open it directly. Adding one would widen Buddgy's `open_setting` list.

## Step 16: invite, guest pass and landing

Boards: S004-top-after, S004-friends-after, S004-ar-after and S005-after, all approved by the owner.

**Guest pass signature.** `GuestPassCardFront` has a new optional `from` prop, and `GuestPassSignature` draws it. It is absent when the name is unknown.
- "from <first name>" is set in Pinyon Script, gilt (`--gold-mid`), right-aligned and tilted -4°.
- An Arabic line ("من <name>") is set right to left, on the left, tilted 3° as drawn, in Aref Ruqaa 700. The font is loaded in `signatureFont.ts` the same way as Pinyon, with `preload: false`.
- Both faces are in the font stack, so a Latin line with an Arabic name still has glyphs.

**Invite screen (BDG-004/006).** All copy is in `rewardsCopy.ts`:
- "37 Days of Pro", with the truthful hero subtitle, steps and fine print ("for new accounts", 7 days, the web friend counts after a phone sign-in).
- The Arabic pass labels are translated: بطاقة ضيف, 30 + 7 أيام, أسبوع, 500 Sparks, ما يحصل عليه صديقك.
- The sign-up placeholder is NOUR-7K2, and the hint adds "for new accounts".

**Friend status.** Held friends show "Waiting for a phone sign-in" or "Being checked" instead of "On its way".
- The reason comes from the new `held` field of `referral_my_summary`. Only `awaiting_native` and `review` on activated rows are exposed.
- Pending rows now also show "· 4 of 5 entries", since `transactions` was already in the payload.

**Landing `/i/<code>` (BDG-005).** The route handler is replaced by a bare page, `src/app/(app)/i/[code]/page.tsx` plus `InviteLanding.tsx`:
- It shows the hero, the signed guest pass, "Tap the pass to see what you get", the "Code saved for sign-up" pill (drawn after the save runs), the benefits, "Create your account" / "I already have buddget" (both go to the sign-up/sign-in sheet as before) and the footer. There is no expiry anywhere.
- The code is saved on open: localStorage, plus the same `buddget_invite` cookie (30 days, `Path=/`, `SameSite=Lax`, `Secure` on https), written client-side.
- A junk code still opens `/`.
- The page is `noindex`.
- `/i` is a bare route in `AppShell`, and the native build stashes `src/app/(app)/i`.

**Migration 0343** (`0343_invite_held_reason_inviter_name.sql`):
- `referral_my_summary` gains `held`. Same signature; the grants are kept and asserted.
- New `referral_inviter_first_name(p_code)`: SECURITY DEFINER, `search_path ''`. It returns the first word of the inviter's display name, capped at 40 characters, or null for an invalid code, an unknown code or referrals off. EXECUTE is granted to `anon` and `authenticated` only.
- Proved on live in a rolled-back transaction:
  - A real two-word name returned its first word only, with no space.
  - Unknown, junk and null codes returned null.
  - The ACL was `{postgres, anon, authenticated}`, with no PUBLIC execute.
  - The anon call ran.
- A second rolled-back proof inserted three referrals for one inviter: activated/`awaiting_native`, activated/`review` and rejected/`device_used`.
  - The summary returned `held` = `awaiting_native` once and `review` once.
  - The rejected row had `held` null.
  - No friend carried a raw `reason`.
  - Afterwards, 0 new referral rows were left.
- After the rollback was confirmed, it was applied. The in-migration asserts passed.
- EXPLAIN: the lookup uses the unique index `referral_codes_code_key` (the table has 51 rows, so the planner seq-scans it today), joined to `profiles_pkey`.
- `get_advisors` flags the new function as anon-callable SECURITY DEFINER. That is intended.
- `database.types.ts` was patched by hand.

| Item | Files | Status |
|---|---|---|
| Signature renders the name, sits left in RTL, absent without a name | `GuestPassCard.tsx`, `membershipComponents.test.tsx` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Held-reason labels (en, ar) and the entries count | `inviteCode.ts`, `inviteCode.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| Landing renders the card, keeps the cookie, shows no expiry; junk code opens the app | `InviteLanding.tsx`, `InviteLanding.test.tsx`, `(app)/i/[code]/page.test.tsx`, e2e I1, R11, J5 | **Automated verification (runner job pending)**: written, not run on the Mac. |
| SQL contract: grants anon + authenticated only, first word only | `inviteLandingSql.test.ts`, e2e I2 | **Automated verification (runner job pending)**: written, not run on the Mac. The rolled-back live proofs above passed. |
| Look of the pass, the invite screen and the landing in en and ar, light and dark | `cards.module.css`, `InviteView.tsx`, `InviteLanding.tsx` | **Manual verification required** (runner screenshot, then owner review). |
| Universal link on a phone with the app installed (it opens the app and does not show the landing) | `src/lib/native/inviteLinks.ts` (unchanged) | **Native verification required**. |

Differences from the boards:
- The landing's third fact reads "<Name> gets 1 WEEK", as drawn. An inviter who is a paying store subscriber earns 500 Sparks instead. The landing cannot know which, because the function returns only the first name.
- The held detail reads "counts once they sign in on a phone", not "she". The app does not know the friend's gender.
- The cookie is now written by the page script, not by a server `Set-Cookie`. The name, lifetime, path and SameSite are the same.
- Until the name arrives, or when there is none, the landing title reads "You’ve got a guest pass" and the pass is unsigned.
- The landing reuses `GuestPassCard` on `CardSpotlight`, `MembershipPanel`, `Badge` (positive), `Button` (cta-block, outline), `Sub` and `Fine`, on an `AppShell` bare page.
- The landing hero is hand-built from the hero tokens (`--color-hero-from`/`--color-hero-to`), not `HeroBand`: `HeroBand` is Flow's numbers band and has no slot for a title and line.
- A junk code may reach `/` through a streamed refresh rather than a 307, because `(app)` has a loading boundary. I1 and R11 assert the outcome: it ends at `/` with no cookie.

## Step 18: real bank logos (BDG-024)

30 of the 48 catalogue banks now show their official logo on a white padded tile instead of the monogram. The other 18 keep today's monogram. `bank-logos.md` lists the sources, licences, sizes and the reason for each skip.

**With logos (30):**
- EG: nbe, cib, banquemisr, qnbeg, aaib, aalex, albarakaeg, hsbceg
- SA: d360, alrajhi, snb, riyadbank, sabb, alinma, albilad, anb
- AE: enbd, adcb, fab
- KW: nbk, kfh, boubyan, burgan
- QA: qnb, qib, cbq
- BH: bbk, nbb, ilabank
- OM: bankdhofar

**Official file found but too wide (6):** mashreq, gulfbank, cbd, aljazira, banqueducaire, bankmuscat.
- Their wordmarks are wider than 4:1 and cannot be read in a 32 to 44 pt square, so they are not shipped.
- Each needs an emblem-only official file, or the owner's call to crop.

**No usable file (12):** faisaleg, adibeg, adib, dib, rakbank, liv, wio, zand, weyay, dohabank, bisb, nbo.

**Not covered:** wallets, BNPL brands and card schemes. They are in scope but were not done in this pass.

**Files:** 27 SVG and 3 PNG (max 512 px), 700 KB in total.
- Largest: `banquemisr.svg` (116 KB), `nbe.svg` (112 KB).
- No SVG optimiser is installed, so the SVGs are sanitised and whitespace-minified only.

**How it works:**
- `BrandMark` gains an optional `logo` prop. Without it, the default is unchanged: the monogram on the brand colour.
- With a logo, the squircle becomes a white tile with a border-token ring, in both themes. The image is padded by 14% of the size, and the alert badge still sits on the corner.
- `src/lib/payment/bankLogos.ts` maps catalogue ids to files:
  - `bankLogoSrc(id)` returns the path for one id.
  - `bankLogoForName(name)` resolves a name through `resolvePaymentBrandKey`, memoised. Generic names such as "Cash" or "Bank" get no logo.
- Paths are root-relative (`/logos/banks/<file>`), the same as `ProviderBadge`'s `/providers/`. The app has no `basePath`, and the Capacitor export serves `public/` at the root.

**Call sites passing `logo`:**
- `AccountRow` (not for Cash) and `AccountPicker`
- the `AddAccountSheet` provider field and `DetectedAccountsSheet`
- onboarding `StepAccounts` (not for Cash)
- Buddgy `AccountPick` and `MoveBody`
- `ProviderPickerSheet` catalogue rows, which reuse `BrandMark` at 38 px when a logo exists and keep the tinted initials otherwise

**Unchanged:** the card faces (`CardFace`, `CardFaceChip`). They print the bank's name as text, not a mark.

| Item | Files | Status |
|---|---|---|
| Map and folder agree. Every id with a file resolves to it, by id and by catalogue name. Banks without a file, and generic names, get no logo. | `bankLogos.ts`, `bankLogos.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. tsc and eslint pass. |
| SVGs carry no script, event handler, foreignObject, image or external reference. PNGs are at most 512 px. | `public/logos/banks/*`, `bankLogos.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. The same regexes pass locally against the files. |
| `BrandMark` logo variant keeps the alert badge. Without a logo it falls back to today's monogram. | `BrandMark.tsx`, `accounts.render.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| A provider picker row shows the logo. A brand without one keeps its initials. | `ProviderPickerSheet.tsx`, `ProviderPickerSheet.pockets.render.test.ts` | **Automated verification (runner job pending)**: written, not run on the Mac. |
| How the tiles look in light and dark at 32 to 44 px. Lockups near 3.5:1 (nbe, snb, riyadbank, enbd, hsbceg, qnb) read mainly by their emblem. | all call sites | **Manual verification required** (runner screenshot, then owner review). |
