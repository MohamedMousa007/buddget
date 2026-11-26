# Light touch redesign: build spec

The owner approved mockup v7 on 2026-11-26. This file is the brief for building it. If anything here disagrees with the mockup, the mockup wins.

## Sources of truth

- **Approved mockup:** `light-touch-v7.html`. Open it in Chrome. It has two phones: "Current" on the left and "Light touch" on the right, which is the target. The bars above the phones open every page, sheet and state.
- **Screenshots:** `screens/` holds one per page, sheet and state in v7, named `page-*`, `sheet-*` and `state-*`.
- **Mockup sources:** `source/`. A sheet is often redefined more than once. **The last definition wins**, in this load order: `lt.js` → `lt-accounts.js` → `lt-more.js` → `lt-v4.js` → `lt-v5.js` → `lt-v6.js`.
- **Never copy mockup markup or raw hex into the app.** Map each mockup helper to the existing component in the table below. Use tokens only (`docs/DESIGN_SYSTEM.md`).

## Rules for every build step

- Reuse first. Adjust existing components with **additive** props whose defaults stay unchanged, then apply them app-wide. Create a component only when the table below marks it as new.
- Every string goes in EN and AR, with RTL checked. Put new strings in a per-feature copy module (the pattern of `src/lib/i18n/*Copy.ts`), so that parallel work doesn't collide in `dictionaries/en.ts`.
- Touch targets are at least 44px. Use the safe-area classes. Numbers use `font-mono-numbers`.
- Deep changes (logic, migrations, money) get tests written next to the code. Tests are **not run** until the owner asks (`CLAUDE.md`).
- Don't run `git add -A`. Agents don't commit; the lead commits per area.

## Shared primitives (built first, then used everywhere)

| Mockup helper | Build as | Where |
|---|---|---|
| `hero4` / `ltTx` amount hero with inline unit (`ctl4`): big amount, then a tappable grey currency, grams or karat with ▾ | **new** `AmountHero`, which wraps `AmountTextInput` and opens `CurrencySheet` (or an option sheet for units) | `src/components/ui/AmountHero.tsx` |
| `pill4`, `date4`, `pick4`: a soft pill with an icon (calendar, repeat) on the right of a row | Extend `DatePickerField` with a generic `PillButton` look. Dates keep `UnifiedDatePicker` | `ui/DatePickerField.tsx` |
| `ltDayPicker`: a 1–31 grid only, with a big ordinal above it (no typing, no "last day", no tip) | **new** `DayOfMonthSheet`, which reuses the `IncomePaydayGrid` cell look | `ui/DayOfMonthSheet.tsx` |
| `ltNumPicker`: type a number or tap a preset chip | **new** `NumberPickerSheet` | `ui/NumberPickerSheet.tsx` |
| `ltOptPicker` / `pickEvery`: radio rows with an icon tile | **new** `OptionSheet` | `ui/OptionSheet.tsx` |
| `ltPocketPicker`: search, sections (Goals, Savings, Safety net), balance and progress, "New pocket" | Extend `PocketPickerField` so it opens a searchable, sectioned sheet | `features/savings-v3/MoneySheetParts.tsx` |
| `ltMethodPicker`: the payment-method sheet used everywhere | Keep `SelectPaymentMethodSheet` | — |
| `srcTabs` (v6): **Account · Pocket · Outside** tab bar. Account opens the payment-method sheet, Pocket opens the pocket picker, Outside has nothing to pick | **new** `MoneySourceField` = `SegmentedControl` + one row that changes with the tab | `features/savings-v3/MoneySourceField.tsx` |
| `tiles4`: four small digit tiles on one row, same height as the rows around it | Extract `Last4Tiles` from `AccountIdentifierField` | `features/payments/accountFormParts.tsx` |
| `H_DEL`, `H_GEAR`, ⋮, X: one size, with red on the bin | Add `variant="sheetAction"` to `IconButton` and use it in every sheet header (`SheetFrame`, `V3SheetHeader`) | `ui/IconButton.tsx` |
| `fa()`: drop `.00` when there are no cents | Add a `smart` option to the money formatter, used on Accounts and every amount list | `src/lib/utils/format*` |
| `bigCard`: the app's `CardFace`. Metal also shows `•••• •••• •••• 1234` and the contactless mark. **No holder name** | Edit `CardFace` | `features/payments/CardFace.tsx` |
| Swipe left to delete, with a tip | `SwipeToDelete` | `components/expenses/SwipeToDelete.tsx` |

## Global (rounds 0–4)

- **Font:** Geist replaces DM Sans in `src/app/(app)/layout.tsx`. Keep JetBrains Mono for numbers and IBM Plex Sans Arabic for AR.
- **Theme:** Light touch, with rounded corners on the hero, banners and lists. The current dark theme must stay working.
- **Currency:** the inline style everywhere (the grey code after the amount, tap to change). Primary currency on rows; a quiet `≈` line when a second currency is on.
- **InstaPay** is removed as a payment method.

## Areas

**Tier** says how deep each change is: `UI`, `logic`, or `migration`.

### A1. Flow (screens: `page-flow`, `sheet-expense`, `sheet-income`, `sheet-scan`, `sheet-s_held`, `state-emptyflow`, `state-noresults`, `state-loading`, `state-buddgy`)

1. Hero (`lt-v6.js` `pageM`):
   - The label reads **Spent**. The big number is spent, with no "of".
   - The right side shows `687/day until Oct 31`.
   - The bar is spent ÷ budget, with the pace tick.
   - The scale reads: month name (or the cycle start date when `monthStartDay > 1`) · `X left` · budget total.
   - In/out sits below the bar, the hero is rounded, and the three stat cells are gone. `useFlowBand` and `FlowSummaryBand` change.
2. The month row is removed. Category chips are removed. A small filters icon button sits next to the All/In/Out segment. All months show in one list, and the budget is the current month.
3. Filters sheet: date range, amount range, the earlier category tile style, and Paid with collapsed until tapped.
4. Expense sheet:
   - The date pill sits top-left, with the bin next to X.
   - The amount hero has the inline currency, and the title is under it.
   - Rows: Category (tiles showing budget left), Paid with (provider logo on the row; the picker has mini cards), Recorded from.
   - Receipt is its own section and only appears when there is a receipt. The note is slim. Leaving with unsaved edits shows a save/discard dialog.
5. Receipt viewer: a fitted, enhanced image that opens on "View image", plus itemised lines.
6. Income sheet: same structure as the expense sheet.
7. Bank messages (`lt-v4.js` `s_held`):
   - The main button is **"Add these N"**.
   - Each row has a bin and swipes left to remove, using the existing `dismissItem` with undo.
   - A swipe tip sits on top.

### A2. Accounts (screens: `page-accounts`, `sheet-account`, `sheet-card`, `sheet-addaccount`, `sheet-addcard`, `sheet-cashout`, `sheet-setaside`, `sheet-cashhand`, `state-cashoff`)

1. Account sheet (`lt-v5.js` `ltAcctSheet`), from top:
   - Balance, with the currency tappable (`updatePaymentMethod`).
   - Cash out · Set aside · Add card.
   - The "Matches your bank's last SMS" box, with the SMS balance in small text.
   - **Cards**, scrolling sideways, with "See all" and the dashed add tile.
   - In / Out this month.
   - The **"Default for new expenses"** switch. It replaces "Make default" in the ⋮ menu; the council kept it because the SMS fallback and preselection depend on it.
   - Recent.
   - While the balance is being edited: the old figure struck through → the new one, plus the difference, and an equal **Cancel | Set balance** button pair. The figure is never inside the button label.
2. Card sheet (`lt-v4.js` `ltCardSheet`):
   - `CardFace` at 320px.
   - Owed in `--color-brand-red-text`, with a red bar.
   - "X available of Y · due on the 15th". **No** "counts as debt" line.
   - The "Default for new expenses" switch, and Spent with this card. The ⋮ menu holds Edit and Delete.
3. Add account (`lt-v4.js` `ltAddAccount`):
   - Bank | Wallet only.
   - Balance hero with the inline currency.
   - The provider picker is filtered by type, with "Not listed? Add it by name".
   - `Last4Tiles`.
   - An optional **Name**; when empty it shows "Provider ••1234". This is the existing `label` column, so no migration; 13 live label-only rows keep working.
   - The dashed "Add a card" empty state.
   - No long note.
4. Add card (`lt-v4.js` `ltAddCard`, plus `floatCard` from `lt-v6.js`):
   - The preview floats over the sheet exactly as in the app today (280px, halo, 64dvh sheet). The new `CardFace` is used.
   - Debit / Credit / Prepaid, Bank or wallet, `Last4Tiles`, Name.
   - Uses (debit and prepaid). Credit adds Limit, Owed now and a Due day `DayOfMonthSheet`.
   - Look: Metal/Classic and swatches. The default switch.
5. Cash out: To is fixed as "Cash on hand". Set aside is its own sheet: From is the account (fixed), and Into opens the pocket picker.
6. Untracked Cash (council): a dimmed "Cash on hand · Not tracked" row on Accounts, with **Start tracking**, which opens `CashOnHandSheet` (`setOpeningBalance`).

### A3. Savings and goals (screens: `sheet-deposit`, `sheet-goal`, `sheet-s_goal`, `sheet-addgoalC`, `sheet-s_ef`, `sheet-efmonth`, `sheet-s_withdraw`, `sheet-s_gold`, `sheet-s_zakat`, `page-goals`, `sheet-celebrate`, `page-wealth`)

1. Savings deposit (`lt-v6.js` `AFTER.deposit`):
   - The icon is the pocket's own; there is no pig.
   - Into opens the pocket picker.
   - `MoneySourceField`:
     - Account maps to `depositToSavings` with `fromAccountId` and the current rules (held pocket first, capped at free money).
     - Pocket maps to `transferBetweenPockets`.
     - Outside maps to mode `declare`.
   - Tier: logic. Write tests.
2. Goal money (`lt-v6.js` `AFTER.goal`):
   - Shows the goal's icon, with no quick amounts.
   - Goal opens the goals-only picker.
   - The same `MoneySourceField`. `GoalAddMoneySheet` gains Pocket and Outside.
   - Tier: logic. Write tests.
3. Goal detail (`lt-v5.js` `s_goal`):
   - Keeps the current design, plus milestone marks on the bar, the passed milestone highlighted, and a bin.
   - Finish line uses the existing calendar in month mode (`DatePickerField mode="month"`).
   - "Each month" opens the **same Fund it sheet** as Add goal.
   - Pocket opens the pocket picker.
4. Goals page:
   - Today's **All · Active · Paused** bar with the **trophy chip** next to it.
   - Goal cards show milestone marks. Prompt and alert banners stay where they are.
   - The achieved view (`AchievedView`) is kept and refined to `lt-v6.js` `achievedView`:
     - A band hero with the count, the total saved, and three facts.
     - A list with a check badge on each icon.
     - A "Next to finish" nudge.
   - `GoalAchievedScreen` stays **exactly as it is**.
5. Add goal = **version C** (`lt-v6.js` `AFTER.addgoalC` and `ltFundIt`). It replaces the `NewGoalFlow` steps, but keeps `GoalChat` behind the Buddgy box.
   - The "Or tell Buddgy" box opens `GoalChat` with the text.
   - Category chips (the `goalVisual.ts` categories). For **Other**, tapping the icon opens a **new** `IconPickerSheet` from the app's lucide set.
   - Icon and name.
   - Target with the inline currency, and "Not sure? Ask Buddgy".
   - Finish line (month mode).
   - A **Fund it** row that opens the Fund it sheet:
     - Three cards: a share of savings (the old range slider, refined, no pig); a fixed amount, which shows **How often: Every month / 3 months / Every year** (council: only for fixed); add it myself.
     - Already saved, with Where is it? as `MoneySourceField`.
   - The pocket note.
6. Goal frequency **yearly** (council):
   - Migration: widen the `goals.frequency` check to `monthly | quarterly | yearly`.
   - Add the type, `goalPlan.step()`, period keys and alerts.
   - On-track is checked on due dates only.
   - Detail copy: "X every 3 months" / "X a year".
   - Tier: **migration + logic**. Write tests.
7. Emergency fund (`lt-v6.js` `AFTER.s_ef`):
   - The months number is inline (no box) between the small − / + buttons, and can be typed.
   - "A simple month" opens the new breakdown sheet (`ltSimpleMonth`): toggle rows with amounts, bars and sources; "Or set it yourself" (`monthlyEssentials`); and "Estimate it with Buddgy". Data comes from `deriveSimpleMonth`.
8. Withdraw, gold and zakat (`lt-v4.js`):
   - **Withdraw:** currency, From/Into pocket picker, a For option sheet, Debt.
   - **Gold:** grams / pounds / oz as the inline unit; the karat segment; Paid from with "Outside buddget"; Bought on.
   - **Zakat:**
     - Rows open Wealth or Debts, and there is no "set it myself".
     - A gear opens settings: nisab basis, stocks, and **year start** (`yearStartDate`) with a calendar.
     - A note says the zakat year is personal (the day wealth reached nisab).

### A4. Debts, subscriptions, budget, payday (screens: `page-debts`, `sheet-s_borrow`, `sheet-s_install`, `sheet-s_vault`, `sheet-debtpay`, `sheet-repaid`, `sheet-received`, `page-subs`, `sheet-sub`, `sheet-s_subadd`, `sheet-s_subcancel`, `page-budget`, `sheet-s_line`, `sheet-s_fixgap`, `page-paydays`, `sheet-s_payday`, `state-emptydebts`, `state-emptysubs`)

1. Debts page:
   - Today's tabs **Borrowed · Installments · Cards**, with no All.
   - Active has a quiet "+ Add" that opens an option sheet: Borrowed money, Installment plan, Credit card (Add card with Credit picked).
   - **Payments** rows use the Flow row component and swipe to delete (`deleteDebtPayment` with `restoreDebtPayment` undo).
   - A cleared-debts link at the end.
2. Borrow:
   - The amount hero has the inline currency. When gold-backed is on, it becomes grams with karat as the unit. Use the **live** gold price, not `AddBorrowForm`'s demo table.
   - The Total / Per payment segment sits under the amount.
   - Person, For, Date, Received in, Arrived, Gold.
   - Plan: Over (`NumberPickerSheet`) and Every (`OptionSheet`).
3. Installment:
   - The same order, with Item first.
   - Provider is the BNPL list.
   - Starts.
   - **Paid with**: a default card. Migration: `debts.default_payment_method_id uuid null references payment_methods(id) on delete set null`, plus an index, the mapper and types. When a payment is recorded, it's preselected.
   - Payments / Every.
   - Tier: **migration**.
4. Cleared debts (`s_vault`): a green summary hero, and two columns of seal cards that expand to "How you paid".
5. Subscription sheet (`lt-v4.js` `AFTER.sub`):
   - Logo, then the **name under it**, then the amount with the inline currency, then the conversion line, then the **status badge**, then "Monthly · …".
   - A bin; **no pause anywhere**. That means removing it from the UI and the Buddgy tools; 0 live paused rows.
   - Statuses are derived: Active, Trial, Payment due, **Needs renewal** (no linked charge for 2 cycles; new derivation), Cancelled.
   - Tier: logic. Write tests.
6. Add subscription:
   - A 72px logo with the name under it.
   - **Editable price** with the inline currency and plan chips.
   - When the price differs from the plan, a note appears and the price is saved with `adoptSubscriptionPrice`.
   - No tracking option; tracking is always automatic.
7. Cancel subscription: the logo with the name under it, the price, "You save X a month / Y a year" cards, and Ends on (calendar pill).
8. Budget line: the Due day pill opens `DayOfMonthSheet`; "Spending from" opens a multi-select of categories (`expenseCategories`); a bin.
9. Payday sheet: the currency can be changed (`IncomeSource.currency`), and the day picker is `DayOfMonthSheet`.

### A5. Insights (screens: `page-insights`, `state-insfree`, `state-inslearn`, `state-insnoinc`; source `lt-v6.js` Insights block)

1. Hero, the analysis band:
   - "October · day 19 of 31", with a status chip.
   - **"At this pace you finish October X over / under"** (from `heroAnswer` and pace).
   - "Spend X a day from now to land on budget".
   - Four finding tiles: Main reason (`categoryShift`, Free), Before payday (`billsBeforePayday`, Free), Unusual buy (`unusualPurchase`, **Pro**), Big day (`weekdayPattern`, **Pro**).
   - For Free users, the Pro tiles are locked, with "2 more findings are in Pro · See Pro".
2. Sections, gated exactly as today by `canSeeAdvancedInsights`. Locked items use the existing locked look (•••• pills, "Unlock with Pro", `LockedFindingSheet`).
   - **Buddgy's read:** Pro gets a deterministic narrative from the detectors, plus two question chips that open chat with a seed. Free gets "Explain my month · See Pro".
   - **Spending pace chart:** you, plan and projection, with tooltips. Free.
   - **Where it went:** a donut, a legend with %, and rows with Δ vs last month. Free.
   - **Month by month:** 6-month bars against the budget line. Free; the Year chip is Pro (also fixes the `lockedRanges` bug).
   - **Patterns:** big day and net worth path. Pro.
   - **What changed:** the feed, with locked Pro findings and the upsell for Free.
   - **Last month in one look:** recap. Pro.
3. States:
   - **Learning** (`MIN_DAYS` / `MIN_EXPENSES`): the hero shows progress, then "What I will show you" with Example cards.
   - **No income:** the hero shows "—", with "Add income".
   - Charts: one axis, a legend for 2 or more series, tooltips, and tokens only.

## Follow-ups (in the report, not built in this pass)

- An admin review queue for user-reported subscription prices.
- "Buddgy's read" written by the AI model. This pass uses a deterministic narrative from the detectors.

## Foundation, built (commit 6b1f4000): use these, don't rebuild them

- **`ui/AmountHero`**:
  - Props: `value`, `onChange`, `currency?`, `onCurrencyChange?` (opens `CurrencySheet`), `unit?` + `onUnitClick?` (grams, karat), `sign?`, `top?`, `label?`, `line?`. Uses the NumberPad on native.
- **`ui/PillButton`**: `Pill` and `PillButton`.
- **`ui/PickerRow`**:
  - The 52px row: `label`, `value`, `onClick`, `chevron`.
  - Goes inside `<Card padding="none" divide>`.
- **`ui/PickerSheet`**: the frame for the small pickers.
- **`ui/DayOfMonthSheet`**: `open`, `value`, `onChange`, `onClose`, `title`.
- **`ui/NumberPickerSheet`**: `open`, `value`, `onChange`, `onClose`, `title`, `presets`, `unit(n)`, `max?`.
- **`ui/OptionSheet`**:
  - `options[{value, title, subtitle?, icon?, tone?}]`.
  - `multiple` mode, with Done.
- **`DatePickerField look="pill"`**: the calendar pill. It uses `UnifiedDatePicker`, with mode `day` or `month`.
- **`PocketPickerField`**:
  - Sectioned and searchable.
  - Props: `goals?`, `onGoalChange?`, `only="goals"`, `look="row"`.
- **`savings-v3/MoneySourceField`**:
  - `value {kind: 'account'|'pocket'|'outside', id?}`, `onChange`, `paymentMethods`, `accounts?`, `pockets`, `excludePocketIds?`, `onAddPocket?`.
  - `children` = rows above it in the same group.
- **`payments/accountFormParts` `Last4Tiles`**: `value`, `onChange`, `label?`, `optional?`.
- **`IconButton` variants `sheetAction` and `sheetActionDanger`**:
  - `V3SheetHeader.Action` / `actions`.
  - `SheetFrame headerActions`.
- **`formatCurrency(..., 'smart')`**: drops `.00` when there are no cents.
- **`CardFace`**: metal shows the full masked number and the contactless mark.
- **Strings**: the shared foundation strings are in `src/lib/i18n/lightTouchCopy.ts`. **Don't edit it.** Each area makes its own copy module.
