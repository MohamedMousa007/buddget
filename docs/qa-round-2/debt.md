# QA Round 2 - DEBT area (read-only; probes deleted; repo clean)
Probes ran with TZ=Africa/Cairo against the real zustand store; raw output in qa2/probe.log (PROBE1-7).

## P0 / P1

### D1 P0 - Manual/recurring/Buddgy debt payment debits the account twice
- src/lib/store/useFinanceStore.ts:681-711 (addDebtPaymentWithExpense), src/lib/accounts/balance.ts:78,97-103
- The store creates the DebtPayment and the Expense with separate generateId()s and never sets `expense.linkedDebtPaymentId`. balance.ts only dedupes via `settledByExpense` (built from linkedDebtPaymentId), so the payment is applied again. Only the SMS path (createSmsExpense.ts:443,657) sets the link. Live DB: 21 expenses with is_debt_payment=true and linked_debt_payment_id NULL.
- Scenario: bank opens at 1000 EGP, pay a 400 personal debt from it. Expected 600.
- Evidence PROBE1: bank balance = 200.
- Fix: generate both ids up front and set expense.linkedDebtPaymentId (add_debt_payment_with_expense RPC already does); backfill migration for existing rows (link by debt_id + date + amount + pm).

### D2 P1 - Debt payment amount is stored in debt units but labelled with the paying currency (cross-currency)
- debtPaymentMapper.ts:12 (`currency: paymentCurrency`, `amount: amountPaid`), :36-39 (originalAmount/amountInPrimary = row.amount); useDebtTabData.ts:~300 (PaymentVM currency = paymentCurrency), :~392 paidThisMonth toBase(amountPaid, paymentCurrency); balance.ts:101 (`apply(..., p.amountPaid, p.paymentCurrency)`); createSmsExpense.ts:~432/~640 writes row.amount (SMS currency) with debt currency.
- Scenario: USD debt, rate 50, pay 4700 EGP => amountPaid 94 (USD). Feed shows "-94 EGP"; "paid this month" adds 94 not 4700; for CC/they_owe payments (no expense) the EGP account loses 94 not 4700 (PROBE6b: 906). After a re-pull, originalAmount/amountInPrimary/rateAtEntry are lost and wrong (rate 1). Gold: grams treated as EGP.
- SMS: a USD SMS settling an EGP plan stores USD amount as EGP units, no conversion.
- Fix: persist amount_in_debt_unit and original (amount, currency) separately (migration), or store debt-unit amount with the DEBT currency and keep the paid amount on the linked expense; convert SMS amount to debt currency.

### D3 P1 - Gold debt payment recorded in grams as an expense in "XAU" with base amount = grams
- useAddDebtSheet.ts:~590-620, useFinanceStore.ts:681-690 (`converted ?? expense.amount`), recurringDebtDueHandlers.ts:~108-120
- Paying 5 g (XAU) on a gold debt posts Expense{amount:5,currency:'XAU'}; XAU has no rate path, so amountInBaseCurrency = 5. Spend is understated (5 vs ~20,000 EGP at 4000/g); account balance debit is 5 EGP + 5 EGP (PROBE3: expense base 5, bank 990).
- Fix: use computed.amountInBase (already computed by computeDebtPaymentRecord) as the expense amount in base currency (record expense in base, note the grams); never fall back to raw amount.

### D4 P1 - Deleting a debt payment (swipe) leaves its Debt/Installment expense; no confirm, no undo
- DebtPaymentsFeed.tsx:~207-214, useFinanceStore.ts:757-775
- deleteDebtPayment removes only the payment. The paired expense stays (spend + account debit remain) while the debt balance is restored; paying again doubles spend. PROBE2: expenses left 1, remaining back to 1000. Conversely deleting the expense (ExpenseDayList/useFlowLedger) leaves the payment (debt stays reduced). Swipe-delete has no confirmation and no undo (toast only).
- Also: reopening a cleared debt does not reactivate the recurring template that reconcileDebtSchedule deactivated.
- Fix: delete/restore the pair together (via linkedDebtPaymentId from D1 or linkedDebtId+date+amount), confirm dialog + undo, reactivate the schedule.

### D5 P1 - Recurring debt "Confirm paid" in the inbox can be double-posted and gives no feedback
- NotificationInbox.tsx:~107-120, recurringDebtDueHandlers.ts:45-125
- Result boolean ignored; the notification card with its Confirm button remains after a successful tap. A second tap (or double tap) re-reads the advanced schedule and posts a second payment dated next period and advances again. PROBE5: payments ["2026-10-05","2026-11-05"] after two confirms. Failures (missing FX rate, debt already paid) are silent. Buttons are size "xs" (<44px, design-system violation).
- Fix: in-flight guard/idempotency key per (schedule, due date), mark notification read/remove on success, toast on result, 44px targets.

### D6 P1 - Credit-card "statement day" accepts values the DB rejects, so the card debt can never sync
- PaymentMethodSetupSheet.tsx:~370 (`v.slice(0,2)`, no range), :~210 parseInt; useAddDebtSheet.ts:~409 (ccPaymentDueDay/ccMinPercent unvalidated). DB: debts_payment_due_day_range CHECK 1..31, debts_minimum_payment_percent_range CHECK 0..100.
- Scenario: enter 0, 00, 45, 99 => upsert fails permanently, and child rows (payments, recurring) hit FK failures; local state looks fine until reinstall.
- Fix: clamp/validate 1-31 (and 0-100) in the form and mapper; show inline error.

### D7 P1 - Installment progress counts payment ROWS, not amounts
- useDebtTabData.ts:~263-280 (`installmentPaymentsCompleted(d, pays.length)`, `remaining = (count-paid)*per`), installmentSchedule.ts
- Scenarios: a half payment counts as a full installment; one payment of two installments counts as 1; a lump-sum early payoff leaves "paid 1/12, remaining 11*per" while true remaining differs; next-due date derived from count so it is wrong. Remaining shown disagrees with calculateDebtRemaining. Card "installmentDue" (installmentPerByCard) adds every linked plan's per-amount regardless of when it is due.
- Fix: derive paid count/next date from totalPaid / per (floor), remaining from calculateDebtRemaining.

### D8 P1 - SMS installment/CC payoff is not atomic and can overpay/never clear
- createSmsExpense.ts:~425-460, ~640-680
- debt_payments insert succeeds, then expenses insert can fail (returns error, payment row remains). A retry (B3/S2 retry path) inserts a second payment, so the debt balance drops twice. Plan selection falls back to `list.length === 1` with any amount (a different installment-provider SMS pays the only plan); no overpay check against remaining (clamped by display only). Server never marks the debt cleared (clearIfFullyPaid is client-only and upsertServerDebtPayment does not call it), so a fully SMS-paid plan stays "active" with remaining 0 and its reminder keeps firing until the client confirm path deactivates it.
- Fix: move to an RPC (add_debt_payment_with_expense exists, but is unused and lacks currency/link/status columns), idempotent on sms_log_id, validate amount <= remaining, settle status server-side or in upsertServerDebtPayment.

### D9 P1 - Pay-debt flow prefills a debt-currency amount but pays in base currency (no currency picker)
- useAddDebtSheet.ts:~255-290 (prefill amount uses selectedRemaining; payment currency only synced to the debt when `mode==='payment'`, which is only set for debtSheetPaymentOnly), PayDebtForm.tsx (no currency control)
- Scenario: FAB "Pay debt" on a 500 USD debt: field prefilled 500, currency shows EGP; pressing Pay posts 500 EGP (about 10 USD). For gold: prefilled 10 (grams) paid as 10 EGP. Recurring sheet has a picker; this one does not.
- Fix: default paymentCurrency to the debt currency (XAU for gold) in the payDebt flow and offer the picker.

## P2

### D10 P2 - Manual payment advances the recurring reminder even when it is not the scheduled instalment
- recurringDebtDueHandlers.ts:19-40 called from useAddDebtSheet.ts:~575/~620 and Buddgy debts.ts:~648
- PROBE4: schedule due 2026-11-05; a 10 EGP extra payment on Oct 27 moves nextDueDate to 2026-12-05, skipping the November reminder. Undo/delete payment never rewinds.
- Fix: advance only when the payment covers the scheduled amount for that due date, or only from confirmRecurringDebtPayment.

### D11 P2 - Editing a debt can corrupt balance/state
- useAddDebtSheet.ts:~385-450 (edit flow)
- (a) currency change on a debt with payments leaves payments in the old unit (remaining mixes units); (b) lowering startingBalance below paid gives negative raw remaining but the debt is not cleared; raising it on a cleared debt leaves status 'cleared' (hidden while owed); (c) disabling the payoff goal cannot remove it (`goal` omitted from the update); (d) person/gold fields can change under existing payments.
- Fix: lock currency/gold when payments exist; re-run clearIfFullyPaid / reopen after edits; send goal: undefined explicitly.

### D12 P2 - Credit-card edit sheet: "Outstanding" field is the opening balance, not the outstanding
- PaymentMethodSetupSheet.tsx:~114 and ~209 (startingBalance), computeCreditCardBalance.ts:~48
- The Debt tab shows startingBalance + card charges - payments. The edit sheet shows only startingBalance under the label "Outstanding"; entering the real statement figure double counts every tracked charge. Blank input cannot reset to 0 (`?? linked.startingBalance`). Changing the card's currency does not change the debt currency. "Statement day" is stored as paymentDueDay and used as due date AND billing-cycle end; gracePeriodDays (default 55) and the 5% minimum are stored but gracePeriodDays is never read (dead field), so the due date ignores the grace period.
- Fix: relabel or compute; model statement day vs due day separately.

### D13 P2 - Credit-card outstanding/charges fail open on unconvertible currencies
- computeCreditCardBalance.ts:~62 (`conv ?? e.amount`), :~126 sumExpensesInDebtCurrency
- PROBE7: a 100 KWD charge with no rate adds 100 EGP to the card. Same pattern: addExpense/addDebtPaymentWithExpense (`converted ?? expense.amount`).
- Fix: exclude and flag incomplete (as computeNetWorth does).

### D14 P2 - Same-last4 or same-name card merge in addCreditCardDebt
- useFinanceStore.ts:576-657
- matchPm treats pm.last4 equality OR name equality as the same card. Two cards from different banks sharing last4 (1234) collapse into one; the existing debt is overwritten by `merged` (startingBalance, limit, due day reset).
- Fix: match on (provider, last4) and merge only provided fields.

### D15 P2 - Paid-this-month / due-this-month use calendar month, ignore monthStartDay
- useDebtTabData.ts:~395 (`isSameMonth(parseISO(p.date), now)`), dueThisMonth uses endOfMonth(now). Inconsistent with every other cycle-aware stat.

### D16 P2 - Dust remainder never clears cross-currency debts
- calculations.ts:~786 (eps 1e-6) with rate conversion: pay the last 10.03 EGP of a USD debt => 5e-5 left, status stays active, remaining shows 0.00, payable list hides it but it never moves to Cleared. Fix: round to currency minor units (or eps 0.005) in isDebtFullyPaid/clearIfFullyPaid.

### D17 P2 - Subscription "Mark paid" repeats for weekly plans (and within 7 days of due)
- useFinanceStore.ts:946-967, subscriptionForecast.ts markPaidTarget (PAY_AHEAD_DAYS=7)
- After paying the current weekly cycle the next charge is always <= 7 days away, so the Mark paid button stays and a double tap books next week's charge as well. Fix: debounce/disable after success and cap pay-ahead per cycle.

### D18 P2 - Resume/Reactivate backfills a charge for a cycle that was paused or cancelled
- useFinanceStore.ts:967-1040 (resumeSubscription/reactivateSubscription), logDueSubscriptions
- pausedAt is ignored by cycleState. Resume after the billing day of the current month: cycle unpaid => overdue prompt, or with tracking 'log' a back-dated charge posts automatically for a period the service was paused/cancelled. Fix: on resume/reactivate move the tracked-from marker to today.

### D19 P2 - Trial that has converted never logs/asks until user taps "Keep"
- logDueSubscriptions (status !== 'active' skipped), lifecycle() treats expired trial as active for forecasts and hero totals, so forecast counts the charge while log/ask mode never fires. Fix: treat expired trial as active in logDue/ask paths or auto-convert.

### D20 P2 - Cancel sets the planner row inactive today, not at endsOn
- useFinanceStore.ts:~1000 cancelSubscription: linked recurring expense isActive=false immediately although access (and the last charge window) remains until endsOn; budget Committed drops early.

### D21 P2 - SMS plan fallback `list.length === 1` and BNPL non-spend flag use a `.maybeSingle()` PM lookup; see D8.

## P3

### D22 P3 - Dead RPC wrappers; sync is per-table so multi-row actions are non-atomic
- rpc.ts:addDebtPaymentWithExpenseRpc, add/cancel/reactivate/updateSubscription..., addIncomeWithDebtRpc have zero callers. Live RPCs also drift: add_debt_payment_with_expense forces category 'Debt' and drops BNPL 'Installment', currency link, linked_debt_id, FX; cancel_subscription ignores ends_on; add_subscription_with_recurring_expense drops trial_end, tracking, price_history, shared, myShare. Wire or delete; do not wire as-is.

### D23 P3 - matchPaymentMethodForExpense matches substrings both ways, falls back to methods[0] (maybe a closed account) and an empty method name matches everything
- matchPaymentMethodForExpense.ts: hint 'a' -> "Cash"; 'visa gold' with a nameless method -> that method. Ignore closedAt.

### D24 P3 - Brand matcher gaps
- resolvePaymentBrandKey: Arabic names never resolve (normalizeBrandToken strips non a-z0-9: "بنك مصر" null), "Souhoola" null though it is an installment provider, "Visa" resolves to a network brand; providerInitials of non-Latin names is "-" (hero falls back to "CC").

### D25 P3 - Subscription mark-paid ignores sub.expenseCategory (always 'Subscription'); only the planner row uses it.

### D26 P3 - decomposePaymentMethodName drops a label when last4 is present (compose ignores tag); name collisions like "Bank ••1234 X" survive unparsed.

### D27 P3 - Recurring debt payments: annually frequency does not anchor (Feb 29 -> Feb 28 forever); weekly rows store dueDay of the first date (meaningless); nextDueDate in the past is accepted with no warning; recurring gold template creates currency 'XAU' expense (D3).

### D28 P3 - Copy/UX: ConfirmPaid button has no loading/toast; Debt feed "Added" rows show "+amount" with a plus sign for a liability; inbox buttons below 44px.

## Evidence index
PROBE1 bank balance 200 (D1) | PROBE2 expenses left 1 (D4) | PROBE3 gold base 5 / bank 990 (D3) | PROBE4 nextDue 2026-12-05 (D10) | PROBE5 two payments (D5) | PROBE6/6b 94 USD vs 94 EGP (D2) | PROBE7 100 KWD = 100 EGP (D13) | brand probe (D23/D24). Live DB: 21 debt-payment expenses unlinked; CHECK constraints on payment_due_day/min percent; expenses.linked_debt_id ON DELETE SET NULL.

## Areas not reached
Buddgy debt tools beyond payment path, ChargesSheet/CreditCardHeroCard rendering, budget debtPayoff/liveLinks, AddInstallmentForm UI, import schema for debts, Arabic copy, DST edge probes for subscription dates (Cairo spring-forward at 00:00), offline/queue behaviour of payments, goals-from-debt (debtGoal), sync merge tie-breaks for debt rows, installment provider catalogue.
