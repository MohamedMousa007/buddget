# QA Round 2 - LEDGER (flow, expenses, income, paydays, categories, refunds, recurring, receipts)

Read-only discovery. One throwaway probe (TZ=Africa/Cairo) proved L1, L2, L5 and was deleted. Items marked [code] are read from code, not executed.

## P1

### L1. Deleting or ending a recurring income erases its received events from all history
- File: src/lib/utils/calculations.ts, actualIncomeForMonth (~line 183-225)
- One-time loop does `if (e.templateId) continue`. Template loop only counts events of templates that still exist AND pass `recurringActiveForWindow`. An event whose template was deleted (IncomeSheetForm handleDelete -> deleteIncomeSource, or swipe delete on a legacy row) or whose month falls after `effectiveEnd` is counted by nobody.
- Scenario: Job paid 12,000 in March (event confirmed, templateId=s1). User deletes the "Job" source after quitting. Probe: with template 12000; template deleted 0; effectiveEnd 2026-02-28 gives 0.
- Effect: past months' income, realized savings, left-to-spend, reports and cash flow drop to 0 for real money received. Money wrong.
- Fix: events with a templateId not resolving to an active template in the window fall through to the one-time path; or tombstone events with the source and warn in the delete confirm.

### L2. sanitizeAmount turns thousands-separated input into 1.25 (1000x wrong)
- File: src/lib/ui/amountSanitize.ts:14-26 (used by AmountTextInput, AmountField, NumberPad flows)
- `,` and Arabic decimal are converted to `.`, extra dots dropped, decimals cut to 2. Probe: "1,250.50" -> "1.25", "1,250" -> "1.25", "1.250,50" -> "1.25".
- Scenario: paste or type "1,250" into Add Expense; the form shows 1.25 and saves it. No warning.
- Fix: if both separators exist, the last one is the decimal; a single `,` followed by exactly 3 digits is a thousands separator; otherwise treat as decimal.

### L3. A duplicate payday event poisons all income_events writes
- Files: supabase/migrations/0082 (unique index on (template_id, occurrence_date) WHERE live), src/lib/supabase/remote/sync.ts OpRunner.upsert/emitList [code]
- Client ids are random UUIDs and the upsert has no conflict handling. If the server already holds a live event for (template, occurrence) that this device lacks (SMS salary auto-match, or a second device) and the user marks the same payday Received/Missed offline, the upsert hits 23505. PostgREST fails the whole array statement, so every other income_events change in that batch also fails, on every retry, until the duplicate is deleted. A pull merges the server row in but does not remove the local duplicate.
- Also a transient version: delete a payday event, then undo or re-mark it within the 500 ms debounce; the upsert and tombstone run in parallel (Promise.all) and the upsert can land first (self heals on retry).
- Fix: on 23505 for income_events, re-query the live row and adopt it (or drop the local duplicate) and retry the rest of the batch; run tombstones before upserts in one tier.

## P2

### L4. Late-payday prompts and credit matching skip the previous cycle for monthStartDay > 1
- File: src/lib/income/paydayResolution.ts:50-62 (openPaydays uses calendar month keys `subMonths(today,1)` and `today`)
- Probe, monthStartDay 25, today Nov 3, payday day 5: openPaydays returns [2026-11-05, 2026-12-04]; the unpaid Oct 5 payday (29 days late, cycle 2026-09) is absent. With day 1 it returns Oct 5 and Nov 5. So "late payday" prompts and "link this credit to a payday" never appear for the older cycle.
- Fix: derive months from `cycleKeyFor(today, monthStartDay)` and the cycle before it.

### L5. Flow month navigation uses calendar month for "current" and never refreshes on rollover
- Files: src/components/features/flow/FlowMonthRow.tsx:38 (`atCurrent = monthFilter >= format(new Date(),'yyyy-MM')`), src/hooks/useCycleAwareMonth.ts, src/lib/store/useSettingsStore.ts (monthFilter set only on dataReady/startDay change), src/lib/expenses/dateRange.ts + useFlowLedger memo
- (a) monthStartDay=25, Oct 10: active cycle key is 2026-09 but calendar says 2026-10, so "next" is enabled and lets the user open a cycle that has not started. (b) monthFilter and the Today/Yesterday/This week presets are resolved once; an app resumed after midnight or after cycle rollover keeps showing the old month/day (no visibility/appState hook resets it; groups also label "Today" from a memoized `new Date()`).
- Fix: compare with `cycleKeyFor(new Date(), startDay)`; re-run on resume and day change.

### L6. Flow band mixes range and month numbers
- File: src/components/features/flow/useFlowBand.ts:~68-75
- Range presets (today, week, custom) are not counted as filters. With no filters the band's Money in comes from `all` (the chosen range) while Money out, budget and left-to-spend come from `stats` (the whole month). On "Today": in +0, out -(month total).
- Also Flow counts income by receivedDate while stats count by occurrenceDate, so a late payday shows in different months on Flow vs Dashboard.

### L7. Amount filter hides everything above 10,000
- Files: src/lib/store/useExpenseFilterStore.ts (AMOUNT_MAX=10000), useFlowLedger.tsx:~305 (`i.amountBase > filters.amtMax`)
- Raising only the minimum activates the filter and silently drops every item above 10,000 EGP (rent, salary). The slider cannot express "no upper limit"; typing a larger max in the box breaks the slider fill (negative inset).
- Fix: treat max === AMOUNT_MAX as unbounded.

### L8. Editing an income event linked to savings or debt breaks the reversal
- Files: src/components/modals/EditIncomeEventSheet.tsx handleSave (amount, currency, date editable even when typeLocked), src/lib/store/useFinanceStore.ts deleteIncomeEvent (~405-465) [code]
- Withdraw 1000 from pocket (pocket -1000, event 1000). Edit event to 800, then delete: pocket gets +800 back, net -200 permanently. The linked debt startingBalance likewise never follows the event amount.
- Fix: lock amount/currency on system-linked events, or apply a pocket correction on edit.

### L9. Income swipe-delete has no confirmation or undo; expense swipe has undo
- Files: useFlowLedger.tsx ~line 290 (`onDelete: () => inc.event ? deleteIncomeEvent(...) : deleteIncomeSource(...)`), useFinanceStore.deleteIncomeSource
- One swipe + tap removes a payday event, reverses a savings withdrawal (pocket balance changes) or deletes a legacy source, with no toast. deleteIncomeSource also forces `noIncomeDeclared: true` when it was the last source even though events exist.

### L10. Receipt breakdown and photo are unreachable; receipts are never deleted
- Files: src/components/receipt/ReceiptDetailSheet.tsx (no importer anywhere), `deleteReceipt` (never called), ExpenseSheetForm (no receipt link)
- Scanned items/charges and the local image are write-only. Deleting the expense leaves the receipt row on the server and the image on the device forever.
- Fix: link "View receipt" from the edit form; cascade delete receipt (and image) with its expense.

### L11. Expense category/subcategory/shared plan data is dropped on sync round trip
- Files: src/lib/supabase/remote/mappers/expenseMapper.ts + expenseCategoryCoercion.ts, recurringExpenseMapper.ts; the `expenses` table has no subcategory or shared_plan_id column
- Custom budget-plan category names become 'Other', `subcategory` and `isRecurring` vanish after push+pull (server updated_at is newer, so mergeList lets the server copy win on the same device). Category chips, plan-row spending and edit-form `isRecurring` toggle silently revert. `amountInBaseCurrency` is hydrated as the raw foreign amount.
- Fix: add columns (or a text category + subcategory column) and map them.

### L12. Cached amountInBaseCurrency still summed in three places
- Files: src/lib/goals/fieldAdvice.ts:12 (averageMonthlySpend; also only excludes 'Savings', so ATM/Transfer/CC Payoff/refunded rows count as spend), src/lib/subscriptions/subscriptionForecast.ts:232 (paidThisMonth) and :249 hero
- After a base-currency switch or on a re-hydrated foreign-currency row (cache = raw amount), emergency-fund advice and Subscriptions "Paid" are wrong. Use expenseAmountInBase and isNonSpendExpense.

### L13. Amount-received sheet bypasses amount sanitising
- File: src/components/modals/AmountReceivedSheet.tsx:~177 (`replace(/[^0-9.]/g,'')`)
- Arabic-Indic digits and the Arabic decimal are deleted as typed on an Arabic keyboard; "1.2.3" is accepted. Same family: EditIncome/Add forms rely on AmountField, but this input is hand-rolled. Use sanitizeAmount.

### L14. Edit expense leaves occurredAt on the old day
- File: src/hooks/useEditExpenseForm.ts handleSubmit (not touching occurredAt) [code]
- Changing the date of a today-entry keeps `occurredAt` (set in addExpense when date === today). Anything keyed on occurredAt (account balance timeline, ordering) places the expense on the original day while `date` shows the new one. Clear or rebuild occurredAt when the date changes.

### L15. Receipt scan accepts 0 amount and unsupported currencies silently
- Files: ReceiptScanSheet.tsx confirm() (no amount > 0 check; the add-expense form blocks it), normaliseReceipt.ts SUPPORTED_CURRENCIES (8 codes vs 13 fiat currencies in the app)
- A receipt in EUR/GBP/JOD/MAD/TND falls back to the user's base currency with the same number (50 EUR saved as 50 EGP). Total unreadable and cleared gives a 0 expense. String amounts like "1.250,50" parse to 1.2505.

### L16. BNPL split silently skipped or saved with a bad first due date
- File: src/hooks/useAddExpenseSheet.ts:~140
- Toggle on but `fundingMethodId` empty (only BNPL methods exist): condition fails, the purchase saves unsplit with no message. An emptied first-due date saves `nextDueDate:''`, `dueDay:0`. First due before the purchase date is accepted.

### L17. Unconvertible foreign expense stored 1:1 as base
- Files: useFinanceStore.addExpense/addDebtPaymentWithExpense (`converted ?? expense.amount`); flow/income rows use fail-open convertCurrency (useFlowLedger.tsx)
- Fallback is only used when live conversion fails, but the displayed Flow amount for incomes and SMS previews uses convertCurrency directly, so an unpriced currency shows as base units in the ledger and totals (extends B10).

## P3

### L18. Week preset starts Sunday (date-fns default); Egypt/Arabic week starts Saturday (dateRange.ts `startOfWeek(ref)`).
### L19. Within a day Flow rows are insertion ordered (expenses, then income, then pending), not by occurredAt; days newest-first, rows oldest-first.
### L20. Delete and "link to payday" exist only as a swipe; the actions sit under `visibility:hidden` at rest (SwipeToDelete), so screen-reader and keyboard users have no way to delete an expense/income. The edit sheets have no Delete button for expenses.
### L21. Edit income event: choosing "Not linked" sets templateId null but keeps occurrenceDate; linking sets templateId with no occurrenceDate (legacy positional pairing). The Unlink button clears both correctly.
### L22. Dead/stale code: types.ts IncomeSource has an orphan "Employer weekend" doc comment (column dropped in 0196); `subcategory`/`categoryChipOptions` are passed through add/edit hooks but ExpenseSheetForm never renders them (fixed category grid only), so subcategory can never be set from the UI; `isRecurring` toggle state in useEditExpenseForm has no UI.
### L23. Spend-excluded expenses (for someone, uncounted cards) are dropped from calculateCashOutflow even though cash left the account (calculations.ts ~line 640, `isNonSpendExpense` skip), overstating net-worth flow.
### L24. Left-to-spend counts every unconfirmed payday of the month as received (actualIncomeForMonth fallback) and an auto-"missed" payday keeps counting until the user marks it; design hazard on salaries that arrive late.
### L25. Payday undo (PaydayActionsCard.remove) re-adds the event under a new id and drops createdAt, sharedPlanId, occurredAt, linked savings/debt ids.

## Not reached
Debt payment expenses (delete leaving orphan debt_payments), AssignIncomeSheet, PaydaysPage/PaydayDetail/Timeline internals, ExpenseDayList/Expenses page, budget lineSpend and categoryOrder logic, voice expense, Buddgy expense/income tools, income import schema, EditExpense of SMS-linked rows, DST edge probes, RTL layout checks, server-side refund matching.
