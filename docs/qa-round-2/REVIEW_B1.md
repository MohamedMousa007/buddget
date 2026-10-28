# Review B1 (adversarial, read-only) - uncommitted B0+B1 diff

Scope: `git diff` (66 files, mixed with B7 ci.yml/package.json), 19 untracked src files, migrations 0197, 0198 x3, 0199, W7_SPIKE.md.
Evidence run: `npx tsc --noEmit` clean; `npx vitest run` 335 files / 3285 tests pass (7 skipped). Live DB (ydihurtbcnoflhormgzi) SELECT only.
Live facts used: debt_payments 5 rows (0 currency mismatches, 0 gold debts); savings_transactions 0 rows with transfer_group_id (0 duplicates); unlinked debt-payment expenses 4 of 6; the four RPC bodies in 0198_rpc_ownership_checks match live `prosrc` after removing the `-- Q6` lines (md5 of whitespace-normalised body identical for all four). Live enums: goal_status = active|paused|achieved; savings_transaction_kind = deposit|withdraw|correct|withdrawal.

Counts: 1 blocker, 6 high, 10 medium, 6 low = 23 findings.

## Findings

### F1 - blocker - Deploy order: client writes columns that do not exist live yet
Files: `src/lib/supabase/remote/mappers/debtPaymentMapper.ts:11-17` (needs 0197), `expenseMapper.ts:16-19` (needs 0199), `savingsAccountMapper.ts:38-39` (0199), `goalMapper.ts:29-31` (enum 'cancelled', 0199).
Scenario: web deploys on push to main. If the push lands before 0197/0199 are applied, every `debt_payments`, `expenses`, `savings_accounts` upsert returns PGRST204/22P02 and the whole table batch fails on every flush for every user (cancelled goal write = enum error). Live today lacks all 11 columns (verified via information_schema).
Fix: hard order: apply 0197 + 0199 (and 0198 trigger/RPC files) first, regenerate types, then push. Put this in the batch commit message and the owner check-in. Old builds are unaffected by the additive columns (verified: `is_recurring` is NOT NULL DEFAULT false, others nullable).

### F2 - high - Recurring savings catch-up posts up to 12 deposits dated today, each debiting the primary account
Files: `src/lib/savings/recurringDue.ts:7-15`, `src/hooks/useRecurringSavingsScheduler.ts:25-35`, `useFinanceStore.ts` depositToSavings (date = `localTodayISO()`, `occurredAt = now`).
Scenario: a recurring deposit whose `nextDueDate` is 5 months stale (app unused, or first run after this upgrade) previously posted ONE deposit and skipped forward. Now it posts 5 (max 12) deposits, all dated today, `mode` default 'allocate' (cash flow) so this month's left-to-spend drops by 5x amount, and with W2 each one also stamps the primary account leg (5x debit). PLAN_REVIEW_B 2.6 said "decide explicitly whether missed months post N deposits or one"; no DECISIONS entry exists. Deleting a posted deposit and a stale second device re-posting the same deterministic id is also not covered (the dedupe only checks live local rows).
Fix: either post one deposit per tick (previous behaviour) with a deterministic id for the newest due date, or backdate each deposit to its due date and mark catch-up rows `isCashFlow:false`. Get owner decision. Add test for 5 stale months.

### F3 - high - `expenseFromRow` still hydrates `amountInBaseCurrency` with the raw foreign amount, so L17 fail-closed is bypassed on every pulled expense
Files: `expenseMapper.ts:57` (`amountInBaseCurrency: row.amount`), `calculations.ts:46-56` (`expenseAmountInBase` falls back to `expense.amountInBaseCurrency`).
Scenario: a USD expense on a base that has no USD rate path (or rates not loaded yet) pulled from the server reads as its USD amount in base (1:1). The new store paths write `0`, `isExpenseUnconverted` and the "≥" marker assume 0. Result: locally created = 0, same row on a second device = raw amount; LEDGER L11 note "fixes amountInBaseCurrency hydration" is not done.
Fix: hydrate with `0` (or null) when it cannot be derived; add a mapper test that a foreign-currency row without rates reads as unconverted.

### F4 - high - W5/W6 UI: `deleteSavingsTransaction` result is ignored, a refused delete is silent
File: `src/components/features/savings-v3/ActivityLedger.tsx:103` (`onDelete={() => deleteTx(tx.id)}`); new `DeleteSavingsTxResult` in `types.ts:705`.
Scenario: user deletes a deposit whose money has since been withdrawn: store returns `would_go_negative` and changes nothing; the swipe row closes/reverts with no message. LEDGER W6 says "message needed".
Fix: show a toast with `shortBy` and pocket name; add i18n key en+ar.

### F5 - high - 0198_savings_rpc_v2: applying changes the LIVE server function `adjust_pocket_balance` behaviour immediately
File: `0198_savings_rpc_v2.sql:423-455` (cron month-carry and goal funding call it today).
Changes vs live def: (a) tombstoned rows now count as "already posted" (a carry the user deleted is never re-posted and the caller still treats it as funded; `allocateGoalFunding` marks the goal paid); (b) `p_delta = 0` no longer inserts a zero ledger row; (c) a non-owned `p_payment_method` now raises. (d) advisory lock + unique index: concurrent same-key run now blocks instead of racing (good).
Fix: call (a) out to owner (it matches the "stay deleted" intent but contradicts the funding "claim" bookkeeping), and test `allocateGoalFunding` against a tombstoned pocket row. Verdict OK-after-fix, see below.

### F6 - high - Q6 is not closed: old unhardened RPCs stay callable, nothing calls the v2 ones
File: `0198_savings_rpc_v2.sql` header ("The client does NOT call any of these yet").
Live `deposit_to_savings`, `withdraw_from_savings`, `correct_savings_balance` still trust `p_currency` (any currency code on a pocket of another currency), no overdraft check on withdraw, no `balance_after`, and `authenticated` can execute them. LEDGER marks Q6/W8 as FIX in B1.
Fix: either keep the rows OPEN in the ledger (partial: SQL staged), or after the client switches, `REVOKE EXECUTE` on the three old functions (installed builds do not call them: rpc.ts has no UI callers per W7_SPIKE).

### F7 - high - Legacy gold-debt payments: mapper fallback defeats the `originalAmount == null` branch
Files: `debtPaymentMapper.ts:36` (`originalAmount: row.original_amount ?? row.amount`), `useDebtTabData.ts:~410` (`d?.isGold && (p.originalAmount == null || ...)`), `balance.ts:102` (`paidAsEntered`).
0197 deliberately leaves `original_amount` NULL for gold debts (grams in `amount`, fiat label in `currency`). After mapping, `originalAmount` is never null, so those legacy rows fall to `paidAsEntered` = grams treated as money of `p.currency` (the exact D3 bug "books grams as EGP") in both "paid this month" and the account ledger leg. Live impact today 0 (no gold debts), but the fix is dead code for any future legacy row.
Fix: in the mapper keep `originalAmount` undefined when the column is NULL, and make `paidAsEntered` fall back explicitly; add a mapper+balance test with a gold row.

### F8 - medium - `is_recurring: e.isRecurring` can be undefined in a bulk upsert
File: `expenseMapper.ts:19`. JSON drops undefined keys; PostgREST fills missing keys of a mixed batch with NULL (not DEFAULT) and the column is NOT NULL, so one legacy/imported expense without the flag fails the whole expenses batch (same class as PLAN_REVIEW_B 3.5). Fix: `is_recurring: !!e.isRecurring` (like `is_debt_payment` on line 28).

### F9 - medium - Buddgy `transfer_between_pockets` pre-check refuses all gold transfers the store now accepts
File: `src/lib/buddgy/tools/exec/savings.ts:338` still uses `tryConvertCurrency`, which now returns null for any XAU leg (`currency.ts:34`). `wealthKit.inPocketCurrency` was moved to `tryConvertWithGold`, this call was not. Gold<->fiat moves via chat always answer "no exchange path", although `transferBetweenPockets` supports them with the gold quote. Fix: use `tryConvertWithGold` with `goldQuoteOf`-equivalent (as wealthKit does). Same family: `savings.ts:438` base value of a gold pocket in the delete preview shows null.

### F10 - medium - `convertCurrency` now returns 0 for any XAU leg; remaining non-gold-aware callers silently lose gold value
`currency.ts:127`. Callers that still pass pocket/holding currencies through `tryConvertCurrency/convertCurrency`: `cycleCarryFigures.ts:49` (XAU savings txs count as 0), `accounts/useAccounts.ts:71-72`, `balance.ts:128` (pocket held in account), `receivable.ts:40`. Previously per-ounce rate (wrong, 31x); now omitted. Acceptable fail-closed but undocumented; grep list above should be reviewed before B1 ships and covered in a gold test.

### F11 - medium - W2 default leg is same-currency only; cross-currency pocket deposits keep inflating net worth
`accountLeg.ts:13-19`, `useFinanceStore.ts` depositToSavings: `resolveAccountLeg(..., acc.currency)` requires the account currency to equal the pocket currency. An EGP account funding a USD pocket gets no leg (and no UI hint). PLAN_REVIEW_B 2.2 allowed "restrict to same-currency in v1 and say so": not stated in LEDGER/DECISIONS. DECISIONS "From account" row (B2) not yet built, so today the default silently applies only when currencies match. Fix: document in LEDGER W2; B2 picker must show the limitation.

### F12 - medium - Account leg default also applies to non-"outside money" callers
`depositToSavings` default (mode 'allocate') now stamps the primary account for `GoalAddMoneySheet.tsx:26`, `aiActionHandlers.ts:748,781`, Buddgy `goals.ts:409`. Intended by DECISIONS W2, but first run after upgrade changes balances of tracked accounts only for NEW deposits (no backfill), so net worth steps once per deposit rather than reconciling history. No test covers the goal add-money path ("declare" is only forced for opening balances). Fix: add the PLAN_REVIEW_B 2.3 probes (goal add money, AI deposit) to `savingsLegs.test.ts`.

### F13 - medium - D1 repair/backup promised by DECISIONS and LEDGER not delivered; trigger only covers future inserts
`0198_debt_payment_link_trigger.sql` states "existing rows are NOT backfilled". DECISIONS (Data repair) and LEDGER D1/L1/DT5 say "link the 21 unlinked... backup table first" (live: 4 unlinked, 1 with linked_debt_id). 0197 contains no `qa2_backup_*` table. Not wrong (additive is safer) but the LEDGER rows must not read DONE: D1 is client+trigger only, the repair is a separate audit-first step. Also stale-device update path: an UPDATE (not INSERT) pushing `linked_debt_payment_id = null` over a linked row is not covered by the BEFORE INSERT trigger when the row exists (upsert conflict path is covered only because BEFORE INSERT still fires; a plain UPDATE is not). Fix: keep D1 open in LEDGER, or add the backup+repair migration after owner SELECT approval.

### F14 - medium - Income payday adoption keeps a different local id, leaves a duplicate local event
`sync.ts:104-137` (`adoptLivePayday`). After a 23505, the code updates the live row and `continue`s, but the local store keeps its own event id. Next pull adds the live row (second event, same template+occurrence). `actualIncomeForMonth` dedupes by occurrence, but Flow/PaydayTimeline lists and delete/undo act on two ids. Fix: after adopting, remap the local id (or drop the local row) through the store, and test two-device same-payday.

### F15 - medium - Orphan-event rule can double count one-time templates
`calculations.ts:224-236`: `orphan = !t || !t.isRecurring || ...`. A NON-recurring template that has events carrying `templateId` now counts its events as orphans AND still counts itself via the `!coveredSourceIds.has(t.id) && inWindow(t.createdAt)` branch (coveredSourceIds only gets template-less events). Probably rare, but nothing prevents `templateId` on one-time sources. Fix: only treat `!t` or ended recurring templates as orphan, or add `coveredSourceIds.add(t.id)` for non-recurring templates that have events.

### F16 - medium - Card outstanding and D13: "incomplete" is computed but surfaced nowhere
`computeCreditCardBalance.ts:42-76`: `cardChargesDetail().incomplete` has no consumer (only `ExpenseDayList` shows "≥"). Unconvertible card charges now drop out of the outstanding balance silently (lower bound shown as exact), previously counted 1:1 (overstated). Fix: expose `incomplete` through `useDebtTabData` and show the existing "approximate" affordance, or keep D13 open.

### F17 - medium - Zakat: tracked accounts ignore per-account `excluded` only; heldInPocket skip assumes `balances.has`
`zakatAccounts.ts:11-17`. `computeBalances` keys include closed accounts? If it includes closed accounts with residual balance they are added to cash; `heldInPocketIds` skips a pocket only when its holding account has a balance entry, otherwise the pocket is counted (fine) but a pocket held in an EXCLUDED account is skipped AND the account excluded, so that money drops out of zakat entirely. Fix: build `heldInPocketIds` only from non-excluded accounts; add test (excluded account holding a pocket).

### F18 - medium - Persist version / state migration (answer to the question)
Only one bump: `PERSIST_VERSION` 21 -> 22 (`useFinanceStore.ts:67`), single new `fromVersion < 22` step (strip XAU rate keys). No second store bumped. Safe for downgrade (older builds `return persistedState` when version >= theirs). Residual: the step cannot restore anything, rates refetch repopulates; verify `WidgetSync`/`/api/rates` consumers do not read `USD_XAU` (route now omits it; `gold` field still carries ounce/gram prices).

### F19 - low - 0197 UPDATE touches every `debt_payments` row
`0197:13-26` updates all rows, firing `a_suppress_noop_updates` (only skips true no-ops; these rows change) and `trg_debt_payments_updated_at`, so `updated_at` moves for all rows: every device re-pulls them and a stale local edit can lose last-write-wins. Live 5 rows, harmless. Keep under the 2-minute pull slack (PLAN_REVIEW_B 3.6). No backup table needed (new columns only), contradicts DT5 wording only.

### F20 - low - 0198 trigger: base-amount equality can mis-link across currencies
`find_unclaimed_debt_payment` and `debt_payments_autolink_expense` compare `amount_in_base`/`original_amount` to the expense amount, which is in the paying currency, not base. A payment with base 500 and an unrelated 500 USD expense same day/method/debt could link. Requires same user, same debt, same date, same method, `is_debt_payment`, so very unlikely. Fix: drop the `amount_in_base` arm.

### F21 - low - Migration naming/doc drift
Three files share prefix `0198` (history already has dup prefixes 0065, 0079, 0092...; live versions are timestamps so apply_migration is unaffected, but a CLI `db push` ordering is alphabetical). LEDGER B1 header lists "0197, 0198, 0199, 0200" and assigns D1->0197, D2->0198, Q6/W7/W9->0199, L11/W22->0200; actual: D2 columns=0197, D1 trigger/Q6 checks/W9+v2=0198, L11/W22=0199. Update the ledger; there is no 0200.

### F22 - low - W7 is a spike only
`docs/qa-round-2/W7_SPIKE.md`: no code change. LEDGER W7 must stay open/DEFER; sync still upserts absolute `current_balance`. Recommendation C is sound; note that recurring catch-up (F2) and W2 legs raise the cost of the stale-device overwrite.

### F23 - low - Assorted
(a) `debtPaidEps` 0.005 is "one minor unit" for 2-decimal currencies but 5 minor units for KWD/BHD/OMR/JOD and large for BTC/ETH debts (`calculations.ts:820`). (b) `incomeEventIdForTx` flips the first hex nibble; legacy withdrawal income events (random ids) are not removed by delete (W5 only fixed for new rows). (c) `localDayKey` throws RangeError on an empty/invalid ISO (was NaN-safe in `slice`); `recurringActiveForWindow` and `filterDebtPaymentsByMonth` now throw on bad data instead of filtering it. (d) `resumeSubscription`/`reactivate` overwrite `createdAt` (used as `trackedFrom`) and `subscriptionToRow` pushes it to `created_at`: intentional for D18, but visible in "member since" style fields.

## Callers of changed exports (grep results)
tryConvertCurrency/convertCurrency/tryConvertWithGold: see F9, F10; all other call sites compile (tsc clean). `netSavingsLedgerInBaseForMonth`, `cashSavingsDepositsInBaseForMonth`, `calculateLeftToSpendCashFlow`: only `monthlyStats.ts` plus tests, `gold` passed everywhere. `depositToSavings/withdrawFromSavings/transferBetweenPockets`: callers listed under F12; `deleteSavingsTransaction`: only ActivityLedger (F4). `reconcileDebtSchedule(debtId, manual?)`: three manual callers pass `{amount, currency}`, `confirmRecurringDebtPayment` unchanged (correct: scheduled confirm always advances). `installmentPaymentsCompleted(debt, payments[])` and `nextInstallmentDueFormatted(debt, completed)`: all 5 callers updated (`useDebtTabData`, Buddgy `debts.ts:95`, `debtsKit.ts:78`); semantic change from row-count to amount-based. `averageMonthlySpend`: one caller (`useNewGoalForm`) updated. `deriveZakatBase`: one caller (`wealth/page.tsx`) updated; `incomplete` field returned but not rendered. `patchAmountInBase` replaces `patchInBase`: one caller updated.

## B1 ledger verification (IDs)
Verified in code: L1 (client calc; see F15), L3 (sync, see F14), L11 (columns + mapper; hydration gap F3), L17 (store paths; F3), L23, W1 (gold units), W2 (same-currency only, F11), W5 (new rows only), W6 (store; UI F4), W9 (SQL staged, F5), W12 (deterministic ids + dataReady; F2), W14 (priority ascending now consistent with new-goal `max+1`), W15, W17 (F17), W22, D1 (client link + trigger, repair not done, F13), D2 (columns+mapper; F7), D7, D10, D14, D16, D18, D19, D20, R1, R2, R11, R17.
Not done / partial: W7 (spike), Q6/W8 (SQL staged, F6), D13 (F16), W13 (only `cycleCarryFigures` realizedOnly; confirm the server month-carry path uses it), W16 (delete-goal uses exclusivePockets; shared-pocket progress unverified), L12 (3 sites: two found changed, third not identified), D3 (F7).
Contradictions with DECISIONS: none direct. Gaps: "Data repair... backup table first" (F13), W2 "From account" row is B2, recurring catch-up semantics undecided (F2).

## Apply readiness
- 0197_debt_payments_amount_units.sql: OK (additive, idempotent `IF NOT EXISTS`, enum cast verified, 5 rows touched, old builds keep reading `amount/currency`). Apply BEFORE the client (F1).
- 0198_debt_payment_link_trigger.sql: OK (columns referenced exist live, `to_jsonb(row)` makes it order-independent with 0197, trigger names sort before `expenses_inherit_exclusion`, definer functions have `search_path` set, REVOKE does not affect trigger firing, idempotent). Optional: drop the `amount_in_base` arm (F20).
- 0198_rpc_ownership_checks.sql: OK (four bodies identical to live except the Q6 asserts, signatures unchanged, ACL preserved, helper functions revoked from API roles). Consider adding `pg_temp` to the search_path of the four RPCs (live omits it too).
- 0198_savings_rpc_v2.sql: OK-after-fix. Index and v2 functions are safe (live: 0 grouped rows, 0 duplicates, new names do not overload). Resolve F5 (adjust_pocket_balance behaviour change on live cron paths) and F6 (do not mark Q6 done) before applying; v2 `ON CONFLICT (id)` and replay checks are sound.
- 0199_sync_roundtrip_columns.sql: OK (additive, `is_recurring` constant default so no rewrite; `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is legal inside the apply transaction on PG12+ because nothing in the file uses the new value). Must be applied before any client that writes `cancelled` goals or the new expense columns (F1); pair with the F8 mapper fix.

Apply order: 0197 -> 0199 -> 0198_rpc_ownership_checks -> 0198_debt_payment_link_trigger -> 0198_savings_rpc_v2 -> regenerate `database.types.ts` -> push client.
