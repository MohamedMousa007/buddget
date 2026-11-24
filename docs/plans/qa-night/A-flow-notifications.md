# QA night, track A: Flow and notifications (bugs 8, 12, 13, 14)

Investigated 2026-11-24 from the code only (read-only, no device run, no tests run). Line numbers are for the branch `claude/qa-bugs-wealth-logic-905035` at `830fce82`. Nothing below was exercised on a device; it is **unverified on a device** unless it says otherwise.

---

## Bug 8: the multi-device notification prompt comes back on every launch

**What the "banner" is.** It is the `PushPrePromptSheet` bottom sheet (a `ModalShell`) at its second step, "Notify on this phone too?" (`settingsHubCopy.ts:226-229`). It is **not** the `BannerStack` prompt stack, and `dismissedBanners` and `snoozedBanners` play no part in it.

**Confirmed behaviour**
- `NativeBootstrap.tsx:51-99` runs once per signed-in user per app start (`bootstrapped` is a ref, so a cold start runs it again).
- When the OS has already granted permission, `pushBootAction` returns `'register'` (`pushPolicy.ts:28-29`). The boot path then calls `notifyCheck()` (`NativeBootstrap.tsx:80`). If `check.ask` is true, it opens the sheet at the second step (`:81-84`).
- `notifyCheck()` (`useNotifyDecision.ts:22-32`) asks whenever this phone is not the main phone and another phone hears notifications. **It never reads this phone's own `notify` value** (`me.notify`, from `user_devices.notify`, through `DeviceRow.notify` in `lib/devices/notify.ts:13`).

**Root cause.** The two answers are stored differently, and only one of them is read at boot.
- **"Yes, notify here too":** `register(true)` sends `notify: true`. `push/register/route.ts:66-68` writes it to `user_devices.notify` (`upsertSelf` creates the row first, so the write lands). Then on the next launch `notifyCheck` still sees "not main + another notifier" and asks again. **This is the path that reappears on every launch.** The same thing happens after the user turns "Notify me on this phone" on in Settings > Your devices (`DevicesSheet.tsx:83`).
- **"No, keep this one quiet"** (also ✕ and a backdrop tap, both mapped to `step.onNo`): `keepQuiet` sets the local `pushOptOut` (persisted in `buddget-ui-settings`, `useSettingsStore.ts:402`). It also calls `reportThisDevice(false)`. On boot, `pushBootAction` then returns `'skip'`, so this path normally sticks. It is lost when `useSettingsStore.reset()` runs: on sign-out, on an account switch (`clearBudgetData.ts:82`, called from `AuthProvider.tsx:311,474`) and on a server reset stamp (`SupabaseFinanceSync.ts:705`). After that, the server-side `notify=false` is ignored, because `notifyCheck` doesn't read it. Secondary path, unverified.

**Recommended minimal fix.** Make the boot path respect a choice already recorded for this phone.
- In `notifyCheck`, return `{ ask: false, explicit: false }` when `me?.notify === true`. That is safe for all three callers: the sheet's Allow, the Settings switch, and boot.
- Handle `me?.notify === false` **only in the boot path** (`NativeBootstrap`): treat it as `'skip'`, or register without asking. Do not short-circuit `false` inside `notifyCheck`. If you did, the Settings switch (`NotificationsCard.tsx:63-81`) would register with `explicit:false`, and then `reportThisDevice(null)` would leave a non-main phone silent while the switch shows On.
- No migration is needed. Reuse `DeviceRow.notify`.

**Regression risks.** A phone whose row has a stale `notify` would never be asked again. If `fetchDevices()` fails offline, the code already falls through to "go ahead". The Settings re-enable path is described above.

**Test label.** Deep technical (device-level state, notification ownership). Add a unit test for `notifyCheck` and the boot decision, with `me.notify` set to true, false and null. **Native verification required** on two phones: answer Yes, cold-start, and confirm there is no sheet. Then answer No, sign out and in, and check the result.

**Open questions**
- After a sign-out, should "No" stay remembered? The server already has `notify=false`, so the recommendation is yes.

---

## Bug 12: Flow notification panels

**A and B do not share an implementation.** A is the app-wide `BannerStack` card gesture, mounted in `AppShell.tsx:357`. B is Flow's mount condition for `IncomePrompts`. They are connected only through the prompt store (`usePromptStore`).

### A: the panel drags in every direction; it should only swipe up to dismiss

**Confirmed behaviour.** `BannerStack.tsx:158-168` (`SwipeCard`) uses framer-motion `drag` with no axis, so both axes are free. It sets `dragElastic={{ top: 1, bottom: 0.1, left: 0.6, right: 0.6 }}` and `dragSnapToOrigin`. In `onDragEnd` (`:146-155`), a vertical-dominant flick upward **snoozes** the card for 3 hours (`snoozeUntil`), and a horizontal flick **cycles** between cards. That matches the docblock (`:30-31`), so the behaviour is intended, not accidental.

**Root cause.** The design allowed both axes on purpose. "Smoothly": a likely cause of the jerk is that `dragSnapToOrigin` springs `y` back to 0 while the `exit` animation drives the same `y` to `-120%`. That is a **hypothesis**, unverified on a device.

**Recommended minimal fix**
- Set `drag="y"`.
- Set `dragElastic={{ top: 1, bottom: 0 }}` and constrain the drag to upward movement only.
- Drop the horizontal branch from `onDragEnd`.
- On a successful swipe, let the exit animation start from the current offset rather than snapping back first (for example, skip snap-to-origin when the threshold is crossed).
- Keep `PromptBanner` unchanged.

**Regression risks**
- Sideways swipe is the **only** way to reach card 2+. The counter dots are `aria-hidden` and not tappable (`PromptBanner.tsx:114-125`). Without the swipe, the user sees the next card only after answering or snoozing the front one.
- This is a shared component: every page's prompts change (dashboard, wealth, usage notices).
- `touch-none` on the card stays.

**Test label.** Complex UI interaction (gesture, shared overlay). Owner hand check on iOS and Android, so **native verification required**. If the cycling decision changes, add a small Playwright gesture check.

**Open questions**
- "Dismiss" today means snooze for 3 hours, so the card comes back. Should a swipe up dismiss permanently (`settlePrompt`)? The recommendation is to keep the snooze. A swipe is easy to do by accident, and the ✕ already snoozes.
- Should there be another way to page through cards, for example tappable dots? The recommendation is none: the stack shows one question at a time.

### B: income panels show only under "In", not "All"

**Confirmed behaviour.** `flow/page.tsx:251` renders `{segment === 'in' ? <IncomePrompts /> : null}`. When it unmounts, `useRegisterPrompts('income', …)` removes the income source from the stack (`usePromptStore.ts`, cleanup effect).

**Root cause.** This is a deliberate design choice, not a defect: the docblocks at `page.tsx:49-51` and `IncomePrompts.tsx:47-52` say so. Changing it reverses that decision. `IncomePrompts` also carries the pass-through prompts (`passthrough`, `passthrough:review`, `IncomePrompts.tsx:136-176`). Those are about spending, and they are hidden on All and Out today too.

**Recommended minimal fix.** Change the condition to `segment !== 'out'`, so the panels show on All and In. If the owner wants them everywhere, mount the component unconditionally. `useFlowLedger` already calls `useIncomeResolution()` for every segment (`useFlowLedger.tsx:137`), so the computation already runs on All. Update the two docblocks.

**Regression risks.** More prompts compete for the single front card on All, so ordering comes from `PROMPT_PRIORITY`: late 10, match 20, sms 30.

**Test label.** UI behaviour, low risk. **Manual verification required.**

---

## Bug 13: transaction time is not shown in the details

**What exists**
- The column is `expenses.occurred_at` and `income_events.occurred_at` (timestamptz, nullable), added in `0151_ledger_links.sql:3,5` with no backfill.
- It maps to `Expense.occurredAt` and `IncomeEvent.occurredAt`, both optional (`types.ts:199-200`, `expenseMapper.ts:36,75`, `incomeEventMapper.ts:50,77`).
- Readers fall back to the date at local noon (`flowOrder.ts:6-8` `instantOf`).

**Writers, and how real the time is**
- **Manual entry, today:** a real instant (`occurredNow`, `useFinanceStore.ts:88-90`).
- **Manual entry, back-dated:** no time (`undefined`).
- **Re-dated in the edit sheet:** a **fabricated local noon** (`useFinanceStore.ts:348-352`), which looks the same as a real 12:00.
- **SMS:** `occurred_at = occurredAtIso ?? receivedAtIso` (`createSmsExpense.ts:270` and others). `receivedAtIso` is the phone's capture time (`sms/parse/route.ts:729,1172`), so the time is real. But when the day comes from the message body (`resolveSmsDay`, `ingestGuards.ts:120-131`), the capture instant can fall on a **different day** than `date`.
- **Pre-0151 rows:** no time.
- `useEditExpenseForm` never writes `occurredAt` directly.

**Timezone.** `formatClock` (`i18n/dateFormat.ts:41-43`) formats in the **device** zone, with digits that are safe in both languages. The server uses `user_settings.timezone`, defaulting to `Africa/Cairo` (see `0320`). For a Cairo phone they match. A travelling phone shows device-local time, which is the norm for ledgers.

**Details sheets today.** The expense details view is the edit form: `EditExpenseSheet`, then `EditExpenseForm`, then `ExpenseSheetForm`. Its header date pill shows only the day (`ExpenseSheetForm.tsx:193-203`, `formatDatePillLabel`). The income details sheet has a facts list, with "Received" and "Arrived" showing `shortDate` only (`EditIncomeEventSheet.tsx:128-157`). No helper shows a time today.

**Existing design pattern for rows.** `savings-v3/ActivityLedger.tsx:121,133` already puts the time in the row subtitle (`"3:30 PM · note"`). It is the only ledger that does. It also prints a **fake 12:00** for date-only rows (an existing small bug). Flow rows (`useFlowLedger.tsx:254-259`) and account activity (`AccountDetailSheet.tsx:162`) show no time. Flow rows sit under day headers, and their subtitle holds the account name.

**Recommended minimal fix**
1. Add one pure helper, for example `displayTime(occurredAt, day)`. It returns a time string only when `occurredAt` exists **and** `localDayKey(occurredAt) === day`, and otherwise null. Reuse `formatClock` / `useLocalizedFormatters().formatTime`.
2. Expense details: show the time next to the date in the header pill (`"Today · 3:30 PM"`), or in the existing reversal audit line style, only while the date is unchanged.
3. Income details: append the time to the "Received" and "Arrived" fact value.
4. Rows: do **not** add time to Flow rows in this pass. Day grouping already orders them, the subtitle is taken by the account name, and the only precedent (Wealth) shows fake times. Offer it as an owner choice using the same helper.

**Regression risks.** Without the guard, the page would show fabricated noons and capture times from the wrong day. Some RTL Arabic layouts may also need checking with the time added to the pill.

**Test label.** UI change plus a pure helper. Add a unit test for the helper (missing time, different day, Cairo/UTC boundary). **Manual verification required** for the sheets.

**Open questions**
- Should re-dating stop fabricating noon (`occurredAt: undefined` instead)? Balances read noon as the fallback anyway. That is a store write change, so it is deep technical and needs a test.
- Should Wealth's `ActivityLedger` hide its fake 12:00?

---

## Bug 14: remove the "not counted" moves and their messaging from Flow

**Confirmed behaviour**
- **Predicate:** an item is `internal = !refunded && isInternalMoveCategory(e.category)` (`useFlowLedger.tsx:216`). `INTERNAL_MOVE_CATEGORIES` is ATM Cash Withdrawal, Transfer, Currency Exchange and Top up (`categoryMeta.ts:29-35`).
- **Already hidden by default:** `items` drops internal rows unless `showMoves` is on (`useFlowLedger.tsx:472`; store default `false`, `useExpenseFilterStore.ts:35-37,61-62,82`).
- **Message:** `flow/page.tsx:258-260` (`t.flow.excludesMoves`).
- **Chip:** `flow/page.tsx:186-201`, prepended to the chips on All and Out (`:207`). Copy lives in `en.ts:3365-3368` and `ar.ts:3377-3380`, and the types in `i18n/types.ts:3088-3091`.

**Two different predicates; check which the owner means.** The chip and message use `internal` (four categories). `isNonSpendExpense` rows are a different, wider set: CC Payoff, Installment, Savings, an excluded account, "for someone". Those **stay visible** with the `CircleSlash` "not counted" badge (`useFlowLedger.tsx:247-248`). The recommendation is to touch only the `internal` chip and message.

**Recommended minimal fix (Flow UI only; no DB or accounting change)**
- Delete the chip (`page.tsx:186-201`) and the message (`:258-260`). Keep the `internal` filter, so those rows stay hidden.
- Remove the orphans this leaves:
  - `showMoves` and `toggleMoves` in the store, and the `reset` field
  - the four i18n keys in en, ar and types
  - the `showMoves` part of `src/lib/store/expenseFilterMoves.test.ts:11-17`
- Keep `isInternalMoveCategory` and its test (`:7-8`).
- Update the comments at `categoryMeta.ts:31` and `useFlowLedger.tsx:60`, and the stale note in `EXCLUSIONS_AND_MULTI_DEVICE_PLAN.md:9`.

**What breaks if only the chip and message go (fix these in the same change)**
- **Empty month:** a month whose only rows are internal moves has `allCount > 0`, so `selectFlowEmptyState` returns `'none'` (`lib/flow/emptyState.ts:23-24`), and Flow shows a blank ledger. Pass `allCount` without internal rows, or count from `all.filter(i => !i.internal)`. The `all.length === 0` check in `useFlowBand.ts:240` has the same issue.
- **Dead-end filters:** `categoryOptions` (`page.tsx:241-244`) and the budget chips can still offer Transfer, ATM, Top up and Exchange, and picking one gives `noMatch`. Leave those categories out of the options.

**Independent of the chip (checked)**
- Totals: band and hero use `counted`, and internal rows are already `counted:false` (`useFlowBand.ts:121,128`).
- Reports, insights and Buddgy read the store and `isNonSpendExpense`, not Flow filters (`useReportsPage.ts:84`).
- Settings "Accounts not counted" (`NotCountedSheet`, `registry.ts:80`) is a separate feature and is unaffected.
- There is no transaction search.
- No e2e spec covers the chip (`docs/qa/round2/S7a-ui.md:47`: unit tests only).

**Reachability (open question).** Today the chip is the only way to see or edit a hidden move. Expense edit entry points:
- `useFlowLedger.tsx:229` (Flow rows)
- `SmsFlagPrompts.tsx:58` and `MerchantCategoryPrompt.tsx:48` (prompts)
- `ExpenseDayList.tsx:98`, used only by debt `ChargesSheet`

Account detail rows (`AccountDetailSheet.tsx:160-163`) are **not tappable**. A misclassified own transfer, such as an SMS booked as Transfer or a wrong "yes" to `OwnTransferPrompts` once its Undo prompt has gone, would become impossible to reach and fix. It still moves balances, and it still appears in the CSV export.

Recommendation: keep a quiet way back that is not on the page. Either:
- (a) a "Show moves between my accounts" switch inside the existing Filters sheet (`ExpenseFilters`), reusing `showMoves`; or
- (b) make the `AccountDetailSheet` activity rows open the edit sheet.

(a) is the smallest change. Decide before removing `showMoves`.

**Test label.** UI change, plus a unit test for the empty-state input if it changes (`lib/flow` already has pure tests). **Manual verification required.**
