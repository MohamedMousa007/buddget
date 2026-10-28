# QA Round 2 - WEALTH (read-only discovery)

Probes used: 2 throwaway vitest files (TZ=Africa/Cairo), both deleted. Repo unchanged. DB: SELECT only.
Proven = reproduced by probe. Code-read = traced in code, not run.

## P0 (money wrong)

### W1 P0 EGP<->XAU conversion treats troy ounces as grams (PROVEN)
- src/lib/utils/currency.ts:35-58 (tryConvertCurrency), consumed by useFinanceStore.ts:1517-1521 (depositToSavings), :1567-1570 (transferBetweenPockets), :1610-1614 (withdrawFromSavings), WithdrawSheetV3.tsx:89, lib/buddgy/tools/exec/wealthKit.ts:50-60 (inPocketCurrency).
- /api/rates (rates/route.ts:101-143) puts XAU in the cross-rate table as ounces per unit (USD_XAU, EGP_XAU...). XAU pockets are in GRAMS. So a path EGP->XAU exists and returns ounces. The comment at store:1565 ("EGP -> XAU grams is rejected") is false once rates are loaded.
- Scenario: EGP pocket 100,000, gold pocket (XAU). Move 100,000 EGP (=0.5 oz = 15.55 g). Probe result: gold pocket +0.5 (g), EGP pocket 0. Value lost ~31x. Reverse (gold pocket -> EGP pocket, or withdraw in EGP from a gold pocket) mints ~31x. Deposit of 100000 EGP into a 10 g pocket gives 10.5 g.
- Fix: in tryConvertCurrency handle XAU explicitly (return null, or require gram price); reject cross XAU moves in the store actions and Buddgy tools; add test.

### W2 P0/P1 Net worth inflated/deflated when accounts are tracked: pocket moves carry no account leg (PROVEN)
- AddSavingsSheetV3.tsx:55 (no paymentMethodId), useFinanceStore.ts:1510-1554, WithdrawSheetV3 (withdraw creates income event w/o paymentMethodId, store:1630-1646), accounts/balance.ts:102-108 (skips tx without paymentMethodId), netWorth.ts:76 (accountsBasis replaces flow term).
- Probe: tracked account opening 1000 EGP, pocket 0. NW=1000. "Add money - from this month's budget" 300 -> NW=1300 (should stay 1000; the money left the account). Withdraw 300 as income -> NW=1000 (pocket -300, account not credited).
- Same for recurring savings deposits (useRecurringSavingsScheduler.ts:29), GoalAddMoneySheet.tsx:26, Buddgy deposit, goal funding by app. Only accounts/actions.ts setAside stamps paymentMethodId.
- Fix: deposit/withdraw 'allocate'/'income' modes must name an account (default primary tracked account) or net worth must treat unattributed legs as flow.

## P1 (broken flow / data integrity)

### W3 P1 Withdraw sheet "Move to pocket" ignores the selected currency (code-read)
- WithdrawSheetV3.tsx:73,122 vs store transferBetweenPockets:1556 (amount always in the FROM pocket's currency). Sheet currency defaults to base currency (line 73), not the pocket's, and canSubmit validates `amountInPocket` using the chosen currency while transfer() sends the raw number.
- Scenario: USD pocket 500, base EGP. Sheet shows EGP selected, user types 100 intending EGP, validation converts to 2 USD, transfer moves 100 USD.
- Also for all purposes the default currency mismatch (gold pocket: user types grams, sheet reads base currency). AddSavingsSheetV3 syncs currency on pocket pick; Withdraw does not.

### W4 P1 Withdraw-to-debt withdraws money but may record no payment (code-read)
- WithdrawSheetV3.tsx:127-137. withdraw() runs first; if debt.isGold and gold price unavailable, or conversion yields 0, `amountPaid > 0` is false -> pocket debited, income not created, no debt payment, no toast. Money disappears.
- Fix: compute amountPaid first; abort before withdraw.

### W5 P1 Deleting a pocket withdrawal leaves its income event (PROVEN)
- store deleteSavingsTransaction:1668-1690. Probe: pocket 500, withdraw 200 (income event created), delete the tx -> balance 500 and 1 income event of 200 remains => income and net worth overstated by 200. Deposits paired with declared opening/goal etc. are fine; withdrawals of purpose income are not unwound. Debt-purpose withdrawals keep their debt payment too.

### W6 P1 Delete tx clamps balance at 0, ledger and balance diverge (PROVEN)
- store:1686, also withdraw:1652, transfer:1591. Probe: deposit 500, spend 400 (bal 100), delete the deposit -> balance 0, remaining ledger = a lone -400 withdrawal. Should block or go negative visibly. Same clamp in ledgerUndo (wealthKit.ts:107).

### W7 P1 Client upserts absolute current_balance over server-side RPC deltas (code-read)
- sync.ts emitList('savings_accounts') + savingsAccountToRow writes current_balance on ANY field change; month-carry/goal-funding use adjust_pocket_balance (server delta). A device with a stale balance that renames/edits/deposits a pocket overwrites the cron deposit while the savings_transactions row survives. Ledger vs balance mismatch with no repair path. Pull-before-push only partly mitigates (mount-time delta).
- Fix: balance derived from ledger or routed through the RPCs (deposit_to_savings etc. already exist and are unused by the client: rpc.ts has no UI callers).

### W8 P1 Server RPCs trust client currency/amount (DB, live def read)
- deposit_to_savings / withdraw_from_savings (live definitions): p_currency is stored but never compared to savings_accounts.currency; balance += p_amount in the account's unit. Calling with USD on an EGP pocket adds the raw number. No overdraft check on withdraw (balance can go negative), no deleted_at check (soft-deleted pocket accepts deposits), balance_after never set (null), p_date defaults to CURRENT_DATE in UTC (Cairo 00:00-03:00 -> yesterday). correct_savings_balance: reads without FOR UPDATE, lost update vs concurrent deposit; no non-negative check; same UTC date.
- Reachable by any authenticated client (PostgREST). Buddgy exec/savings.ts may route here too.

### W9 P1 adjust_pocket_balance idempotency is check-then-act with no unique index (DB)
- migration 0154/0155 (live def identical). SELECT balance_after WHERE transfer_group_id=... then UPDATE+INSERT, no lock; no unique index on savings_transactions(account_id, transfer_group_id) (index list checked live). Two concurrent cron runs (retry + manual, or overlapping 60s invocations) can both pass the check and double-credit. Also accepts p_delta=0 and never validates sign vs p_kind (abs(p_delta)).
- Fix: unique partial index on (user_id, account_id, transfer_group_id) and INSERT ... ON CONFLICT before UPDATE, or advisory lock.

### W10 P1 Zakat sheet: "Save"/"Log payment" button stamps lastPaidDate = now (code-read)
- ZakatSheet.tsx:226 and deriveHawl (hawl.ts:52-59). The primary button, labelled "Save" when nothing is due, sets lastPaidDate to now (pretends a payment was made, restarting the year). When yearStartDate is set (the normal case) it wins over lastPaidDate, so a real payment never advances the hawl date. No amount recorded, no expense/pocket movement, no history.

### W11 P1 Zakat line inputs freeze live values just by focusing and leaving them (code-read)
- ZakatSheet.tsx:119,137: uncontrolled `defaultValue={fmtNum(value)}` with `onBlur -> editLine`; non-empty text always becomes an override. Tabbing through fields turns each live value into a rounded permanent override (formatWhole rounds), so prices/balances stop updating zakat. Arabic digits or "1.5k" parse to NaN -> 0 override (zeroes the line). Clearing the field removes the override but the input still shows blank until remount; defaultValue also never refreshes when the base changes.

### W12 P1 Recurring savings scheduler can double-post across devices / before hydration (code-read)
- hooks/useRecurringSavingsScheduler.ts mounted in ModalProvider.tsx:29, not gated on dataReady or sync. First tick at mount uses the persisted (possibly stale) nextDueDate; two devices each post a deposit (distinct ids) for the same due date. Missed months are collapsed into one deposit (loop skips ahead). No account leg (W2).

## P2 (edge / degraded)

### W13 P2 Month-carry sweeps PROJECTED income that never arrived (code-read)
- cycleCarryFigures.ts:42 -> actualIncomeForMonth (calculations.ts:216-226): recurring template with zero events counts perOccurrence*paydayCount ("behavior preserved"). The cron posts real ledger deposits from the primary account for money the user may not have received (late salary), pushing that account negative and inflating the pocket.

### W14 P2 resolveCarryDestination priority order is inverted and "vault" fallback picks goal pockets
- monthCarry.ts:81-85 sorts priority DESC but the app's convention is ASC (types.ts:1016, allocateMonth.ts:29, SplitSavingsSheet, new goal priority = max+1): carry goes to the LOWEST-priority goal's pocket.
- monthCarry.ts:96: `eligible.find(p => p.type==='vault')` matches the per-goal pockets created as type 'vault' (useNewGoalForm.ts:204, GoalAddMoneySheet.tsx:23, allocateGoalFunding.ts:81, cron:154) so the "Monthly Savings" fallback can be some goal's pocket.
- store addGoal priority = goals.length (useFinanceStore.ts:1133) collides after any delete; DebtGoalPrompt/newGoalForm use max+1.

### W15 P2 Goal funding claim-then-pay can strand a goal
- allocateGoalFunding.ts: run row inserted (claim) before the deposit; if the function dies/timeouts (maxDuration 60) between them, the rerun sees `done`, deducts the amount from `left`, skips payment. Goal never funded that cycle and the money is neither deposited nor swept.

### W16 P2 Goal progress inconsistencies
- computeGoalProgress.ts:64-73 ignores manualCurrentAmount when pockets are linked; allocateGoalFunding.ts:46 uses manual + linked. Cron stops funding at a different point than the UI shows.
- One pocket linked to several goals counts fully toward each (all show same progress, all auto-achieve together; reconcileAchievedGoals.ts); achieved is sticky after the money is withdrawn. DeleteGoalSheet "move" transfers the whole shared pocket away from other goals and ignores transfer failure (returns false, goal deleted anyway).
- useGoalProgress.ts:15,18 subscribes to whole settings store and uses uncounted s.debts (excluded debts still count) unlike wealth page.

### W17 P2 Zakat ignores tracked-account balances
- zakatInputs.ts:23-50 reads pockets and holdings only; net worth (netWorth.ts) uses accountsBasis. Users who track bank/cash accounts get cash under-counted (nisab/due wrong).
- Also fail-open convertCurrency at zakatInputs.ts:55,69,76, wealthModel.ts:93,99 (holding EGP->base), netWorth.ts:73 (returns raw amount when no path). Yearly debt deduction ignores remaining balance (installment*12 even for a debt with 2 payments left).
- "Zakat is due" is shown the moment wealth >= nisab; hawl completion is never checked (hawl date shown separately). Badge date hidden for placeholder but amount still shown.

### W18 P2 Zakat sheet hardcodes "EGP" and English copy
- ZakatSheet.tsx:104,105,107,145,166 hardcode EGP though values are in base currency (AED/SAR users see wrong unit); nearly all labels (Zakat is due, What counts, Cash & savings, Debts due this year, Remind me, Log zakat payment...) are untranslated English; wealth page `totalPrefix='At least'` (page.tsx:~253,~259) too; hawl date forced `en-GB`. Arabic UI breaks.

### W19 P2 Price freshness vs cron cadence
- vercel.json cron prices daily 03:00 UTC; freshness.ts windows gold/crypto 6h, fx 12h. From ~09:00 UTC (noon Cairo) every gold holding, crypto, stock (needs SAGHA_USD) is "unpriced" until some client triggers /api/prices/refresh (debounce 1h server, 3h per device, useAssetPrices.ts:30,75). Hero then shows "At least", zakat excludes gold, trend disabled. The self-heal check uses the OLDEST row over all symbols, so an orphaned stock row (48h window, never deleted) keeps every client in "stale" mode and re-crawling hourly.
- Gold exists in two valuations: XAU pockets/gold debts use spot*official FX (goldPricePerGram from /api/rates, marketData.ts) while holdings use the Egyptian Sagha local sell price (~2% apart + local premium); zakat nisab uses the Sagha one with spot fallback.
- BTC/ETH pockets are valued only by FX rates (savingsConversions.ts:26): no path -> permanently "unpriced" even though asset_prices has BTC/ETH. CoinGecko list is BTC/ETH only (coingecko.ts:7); other coins/EGX tickers never price (Finnhub free tier, USD only, fetchKeyed.ts has no pagination).

### W20 P2 Deleting a pocket rewrites history and orphans links
- store deleteSavingsAccount:1465-1486 hard-removes its transactions (tombstoned on sync), changing past months' "allocated"/left-to-spend and monthlyFlow; income events (linkedSavingsAccountId) and payments funded from it remain. canDeletePocket.ts only blocks default/only pocket, not pockets with balance; page offers a confirm with no undo. Same for deleteInvestmentHolding (no confirm text on cost, no undo).

### W21 P2 Invest-from-pocket ("transfer" purpose) leaves cost basis stale
- WithdrawSheetV3.tsx:145-148: quantity += qtyAdd but unitCost/costBasisCurrency unchanged, so investReturnPct (wealthModel.ts:97-101) treats new units as bought at the old unit cost. Also float quantity from EGP division (no rounding to unit precision) and the money is withdrawn before the holding update (no rollback if holding vanished).

### W22 P2 Mapper loses data
- savingsTransactionMapper.ts:30-35 coerces unknown kinds ('correct' written by correct_savings_balance, transfer kinds) to 'deposit' on pull, so a downward correction shows as a deposit and counts in cashSavingsDepositsInBaseForMonth. balance_after always null.
- savingsAccountMapper.ts: targetAmount/emoji (types.ts:636) never synced; savings account has no updatedAt so merge tie always favours server.
- goalMapper.ts:42 'cancelled' becomes 'paused' on write.

## P3 (polish / hygiene)

- W23 useNetWorthTrend.ts:23-64: trend state never cleared when snapshots <2 or currency/basis changes (stale trend); legacy basis snapshots include the monthly flow term so the chart dips every cycle start; writes even when nw.netWorthIncomplete.
- W24 useEnsureMonthlySavingsVault.ts:25 hardcodes English "Monthly Savings"; default pocket names `${goal} pocket` English; cron notification text (month-carry route.ts:179-180) English only while a dictionary is loaded.
- W25 EditSavingsAccountSheet.tsx:75-86 lets the user switch category/type of the default carry pocket (becomes ineligible, carry silently reroutes) and parseFloat accepts negatives (clamped to 0 silently).
- W26 recurringSavingsDates.ts:5 uses local `new Date()` + setDate clamp ok, but scheduler date math drifts month-end rows; hawl.ts uses 354 fixed days (no Hijri calendar) and `lastPaidDate` stored as ISO timestamp while yearStart is a date.
- W27 transfer/withdraw rounding: amounts are floats with no minor-unit rounding (0.1+0.2 balances, tolerance 0.0001/0.001 differ across code paths: store 0.0001, sheet 0.001).
- W28 Zakat manual override toggled on with an empty field saves 0 (shows "no zakat due" and hides the badge).
- W29 DEFAULT_GOLD_PRICE_PER_GRAM=562 (AED-scale) with EGP default base is used after reset until a fetch succeeds; goldPriceStale price is counted indefinitely in net worth with only a flag.

## Areas not reached
Savings holdings add/edit forms (AddHoldingSheet, AssetFormSheet validation), ActivityLedger, EmergencyFundSheet, AccountDetail/MoveMoney/UpdateBalance/FixGap sheets and gap detection UX, reports net-worth pages, Buddgy savings/goals write tool full audit (exec/savings.ts 740 lines only skimmed), goal detail sheets/checkpoint notifications, evaluateGoalAlerts, investment page, RLS/policies of wealth tables, savings_month_summary consumers, offline replay/double-submit of sheets (no submit lock found in Add/Withdraw sheets: not verified), Arabic RTL layout of wealth screens.
