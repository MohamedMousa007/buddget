# S-2: pocket withdrawals and net worth — design and implementation plan

Status: design decided (council, section 4), ready to execute. Branch: `claude/s2-pocket-networth-design-7eb078`.
Source finding: S-2 in `docs/qa/round2/S8a-review.md` (branch `origin/claude/s8a-qa-fix-review-2159fb`).
Execution model: Sonnet for every slice (mechanical coding against the rules below). No tests run on the Mac; every run goes to the cloud qa-runner.

## 1. The problem

Since QA-13 a pocket can be **held in** a tracked account (`savings_accounts.held_in_payment_method_id`). A held pocket is an earmark inside that account:

- net worth counts the account's ledger balance and **skips** the held pocket (`netWorthBasis.ts:22`, `netWorth.ts:62`);
- the account's free amount is `balance − held pockets` (`balance.ts:143`).

So when money leaves a held pocket and leaves the account with it, the **account balance must drop**. Today it does not: `computeBalances` only moves an account for a pocket transaction that carries a `paymentMethodId` (`balance.ts:111-122`), and no withdrawal writes one.

There are five ways out of a pocket, not four (invest has the same defect):

| Exit | Writer | Rows written today | Account leg today |
|---|---|---|---|
| Back to income | `withdrawFromSavings(…,'income',{toAccountId})` (`useFinanceStore.ts:1873`) | withdrawal tx (no account); income event with id `incomeEventIdForTx(tx.id)`, carrying `paymentMethodId = L` when a tracked account other than the holder is chosen | L +x only |
| Spend | `withdrawFromSavings(…,'spend')`; optional expense with `fundedFromSavingsTxId` and `paymentMethodId = DEFAULT_CASH_ID` (`WithdrawSheetV3.tsx:170-178`) | withdrawal tx; maybe an expense that `balance.ts:83` and `calculateCashOutflow` skip | none |
| Pay a debt | `withdrawFromSavings(…,'debt',{txId})` + `addDebtPayment({fundedFromSavings, fundedFromSavingsTxId})` (no expense, no account) | withdrawal tx; debt payment skipped by `balance.ts:102` | none |
| Invest | `withdrawFromSavings(…,'transfer')` + `updateInvestmentHolding` | withdrawal tx; holding quantity up | none |
| Move to another pocket | `transferBetweenPockets` (`useFinanceStore.ts:1827`) | two tx sharing `transferGroupId`, `isCashFlow:false`, `source:'transfer'` | none |

Other callers of the same store actions: Buddgy (`buddgy/tools/exec/savings.ts:322` income or spend, `:379` move), the AI action handler (`ai/aiActionHandlers.ts:845`, default purpose income) and `DeleteGoalSheet` (move). None writes its own rows, so a read-side fix covers them all.

The withdrawal purpose is **not persisted** on the row. What tells the exits apart in the data: `transfer_group_id` (move), `is_cash_flow = false` with no group (opening, declared money, correction), a paired income event (income), `funded_from_savings_tx_id` on a debt payment or an expense (debt, logged spend), nothing (plain spend, invest).

### Effect on a held pocket today (account H tracked and counted)

| Exit | Net worth today | Correct |
|---|---|---|
| Income, kept in H (no account) | 0 | 0 |
| Income to another account L | **+x** (L credited, H not debited) | 0 |
| Spend (logged or not) | **0** | −x |
| Pay a debt | **+x** | 0 |
| Invest | **+x** | 0 |
| Move to a standalone pocket | **+x** | 0 |
| Move from a standalone pocket into the held one | **−x** | 0 |
| Move between pockets of two different holders | 0, but both account balances are wrong | 0 |

H's free amount is wrong in the same cases (a spend raises "free" by x).

Standalone pockets (no holder, or a holder that is untracked or not counted) are **already correct** in every exit: the pocket is counted on its own, so its balance drop is the net-worth movement. The legacy basis (no tracked account at all: `savings + investments + income − cashOutflow − debt`) is also correct and is not touched. `calculateCashOutflow`, left-to-spend and "spent this month" are not touched.

### Evidence on live (counts only, 2026-11-20)

- 29 pockets; **1** held in an account (tracked); 1 user.
- 6 withdrawal-side rows in total (4 corrections, 1 move, 1 plain); **0 on the held pocket**.
- The held pocket has 1 row: its opening deposit (`is_cash_flow = false`).

No existing row is wrong, so **no data repair and no migration** are needed. The fix is read-side and applies to old and new rows alike.

## 2. The design

**Rule.** A pocket transaction moves the holding account exactly when the money crosses the holder's boundary.

In the savings loop of `computeBalances` (`src/lib/accounts/balance.ts`), for a transaction `t` of a pocket with holder `H`, the first matching case wins:

| # | Case | Leg |
|---|---|---|
| 1 | `t.paymentMethodId` is set | unchanged from today: other account ±, holder ∓, skipped when that account is the holder |
| 2 | the pocket has no holder | none (unchanged) |
| 3 | `t.transferGroupId` is set | find the other leg of the group and its pocket's holder `H2`. `H2 === H`: none. Otherwise: withdrawal `H −amount`, deposit `H +amount`. A missing other leg counts as a different holder |
| 4 | `t.isCashFlow === false` | none (opening, declared money, correction: the earmark changed, the money did not move) |
| 5 | deposit | none (unchanged: an earmark of money already in H) |
| 6 | withdrawal with a paired income event (`incomeEvents` row whose id is `incomeEventIdForTx(t.id)`) that has **no** `paymentMethodId` | none: released inside H |
| 7 | any other withdrawal (spend, logged spend, debt, invest, income sent to another account) | `H −amount` |

`apply()` already ignores an untracked account and rows at or before the account's opening anchor, and an excluded account is computed but not totalled, so those cases need no extra code (they get tests).

Why read-side: one branch fixes every writer (sheet, Buddgy, AI handler, goal delete), rows written by older builds, and every delete or undo (when the withdrawal row goes, its leg goes; when Undo puts it back, the leg returns). No new column and no new writer contract.

**Three supporting changes** (the rule alone is not enough):

1. **Exact time on the rows.** `withdrawFromSavings` and `transferBetweenPockets` write no `occurredAt`, so the leg would land at noon and could fall on the wrong side of an opening anchor set the same day. Stamp `occurredAt` (the same `nowIso` as the income event; one instant for both transfer legs), as `depositToSavings` already does.
2. **Deleting a held pocket must not bring spent money back.** `deleteSavingsAccount` drops every transaction of the pocket, so the derived legs would vanish. When a pocket with a holder is deleted: inside the same store action, compute balances before and after the delete, and for every tracked account whose balance changed write one ordinary signed `AccountAdjustment` (`delta = before − after`, reason `manual_update`, note `Pocket closed: <name>`). Undo of the delete (`pocketUndo.ts`) removes those adjustments. Standalone pockets keep today's behaviour (section 9).
3. **The sheet for a held pocket.** "Back to income" defaults to **stays in the holding account** (a release, no account leg); other accounts remain selectable. "Spend" shows one hint line for a held pocket: if the purchase is already recorded on the account (a bank SMS or a manual expense), choose "Back to income" instead, so the account is not charged twice.

**What "Spend" means, stated once:** the money left the pocket and its holding account now, and nothing else recorded it. The optional logged expense stays skipped by the balance (`fundedFromSavingsTxId`), so the withdrawal row is the only account leg.

**Invariant the rule relies on:** a pocket's holder is set when the pocket is created and never changed afterwards (today only `PocketFormSheet.tsx:94` and `studioEntities.ts:105` set it; no edit path exists). Changing it later would move every past leg to another account. Slice A pins this with a comment on the type; any future "change holder" feature must freeze balances the way slice C does.

## 3. Worked examples

Start: bank **H** 10,000 (tracked), wallet **L** 1,000 (tracked), pocket **Trip** 3,000 held in H, standalone pocket **Q** 500, card debt 2,000, no holdings.
Net worth = 10,000 + 1,000 + 500 − 2,000 = **9,500**. H free = 7,000. Each example starts from this state.

| # | Exit | Today | After the fix |
|---|---|---|---|
| 1a | Income 600, stays in H | Trip 2,400; H 10,000; free 7,600; NW 9,500 | same (already right) |
| 1b | Income 600 to L | H 10,000; L 1,600; NW **10,100** | H 9,400; L 1,600; free 7,000; NW **9,500** |
| 2 | Spend 600 (logged or not) | Trip 2,400; H 10,000; free 7,600; NW **9,500** | H 9,400; free 7,000; NW **8,900** |
| 3 | Pay 600 of the card debt | debt 1,400; H 10,000; NW **10,100** | H 9,400; debt 1,400; NW **9,500** |
| 4a | Move 600 Trip → Q | Q 1,100; H 10,000; NW **10,100** | H 9,400; Q 1,100; NW **9,500** |
| 4b | Move 500 Q → Trip | Q 0; Trip 3,500; H 10,000; NW **9,000** | Q 0; H 10,500; free 7,000; NW **9,500** |
| 4c | Move 600 Trip → another pocket held in H | nothing moves; NW 9,500 | same |
| 5 | Invest 600 | holding 600; H 10,000; NW **10,100** | H 9,400; holding 600; NW **9,500** |

Reversals: deleting the debt payment of example 3 removes the withdrawal row, so H returns to 10,000, Trip to 3,000, the debt to 2,000, and net worth stays 9,500. Deleting the Trip pocket after example 2 leaves H at 9,400 (the adjustment replaces the lost leg) and net worth at 8,900.

## 4. Decisions (council, 2026-11-20)

All four voices agreed on every point (record in section 10).

| # | Question | Decision |
|---|---|---|
| D1 | What survives deleting a held pocket | Freeze with account adjustments, existing reason `manual_update` plus a note. No migration (a new reason would need a CHECK change that older builds do not know) |
| D2 | Default of "Back to income" for a held pocket | Stays in the holding account |
| D3 | Purchase already booked by SMS, then "Spend" from the pocket | Accept and log as a known limit; one hint line in the sheet; expense linking is a later feature |
| D4 | Persist the purpose on the row | No. Derive only (a second source could disagree with the rule) |

## 5. Slices

All on this branch; `git add` own paths only. Tests are written first; nobody runs them locally.

### Slice A — balance rule (Sonnet). No dependency.
Files: `src/lib/accounts/balance.ts`, `src/lib/accounts/__tests__/balance.test.ts`, `src/lib/store/types.ts` (comment on `heldInPaymentMethodId` only).
Change: the rule table of section 2. Build once before the loop: the `pockets` map (exists), a map of income events by id, a map `transferGroupId → legs`. Import `incomeEventIdForTx` from `@/lib/savings/accountLeg`. Update the comment on `balance.ts:83` (the pocket withdrawal carries the account leg). Keep integer minor units by going through `apply()`.
Failing tests first (hand-built rows are fine here, this is the pure function), one per rule row:
- spend from a held pocket: holder −x, `free` unchanged;
- debt-funded and invest withdrawals: holder −x;
- income with a paired event without an account: holder unchanged; with account L: holder −x and L +x (the event's own credit, counted once);
- correction (`isCashFlow:false`, no group) and the opening deposit: no leg;
- move held → standalone: holder −x; standalone → held: holder +x; same holder: none; two holders: −x and +x; orphan leg: treated as crossing;
- holder untracked: no balance entry and nothing thrown; withdrawal dated before the holder's opening anchor: no leg;
- existing tests still pass (deposit with `paymentMethodId`, the held figure).

### Slice B — timestamps and the store-driven proof (Sonnet). After A.
Files: `src/lib/store/useFinanceStore.ts` (only `withdrawFromSavings` and `transferBetweenPockets`), new `src/lib/accounts/__tests__/pocketExitsNetWorth.test.ts`.
Change: `occurredAt: nowIso` on the withdrawal tx (move the existing `nowIso` declaration above the tx); one shared `occurredAt` on both transfer legs.
Failing tests first, **driven through the real store actions** (memory: test the real data shape; no hand-built rows): seed H, L, Trip held in H, Q and a card debt; run each exit of section 3 through `withdrawFromSavings` / `addDebtPayment` / `addExpense` / `transferBetweenPockets` with the same arguments `WithdrawSheetV3.commit` passes, then assert that `accountsBasisFor` + `computeNetWorth` give the "after" column and that every written tx has `occurredAt`. Add the reversals: `deleteDebtPayment` then `restoreDebtPayment`; `deleteSavingsTransaction` of a spend.
Conflict note: the sync branch `claude/ecstatic-shamir-e2f695` edits `restoreDebtPayment` (lines 981-1003, the S-3 stamps), `updateIncomeEvent` and two undo setters in the same file. This slice edits lines 1827-1947 only; do not touch those hunks.

### Slice C — deleting a held pocket (Sonnet). After B (same file).
Files: new `src/lib/accounts/pocketCloseAdjustments.ts` (+ test), `src/lib/store/useFinanceStore.ts` (`deleteSavingsAccount` only), `src/lib/savings/pocketUndo.ts` (+ test).
Change: pure helper `pocketCloseAdjustments(before, after, pocketName, nowIso)` that runs `computeBalances` on both states (convert with `tryConvertCurrency` and the state's rates) and returns one adjustment per tracked account whose balance differs by at least one minor unit. `deleteSavingsAccount` calls it only when the pocket has `heldInPaymentMethodId`, inside the same `set`, and appends the rows to `accountAdjustments`. `deletePocketWithUndo` records the adjustment ids the delete added and removes them in the Undo.
Failing tests first: spend from Trip, delete Trip → H balance and net worth are the same before and after the delete; Undo → balances equal the state before the delete and no adjustment is left; deleting a held pocket with no crossing rows writes no adjustment; deleting a standalone pocket writes none.

### Slice D — sheet default and hint (Sonnet). Independent of A-C (different files); can run in parallel with them.
Files: `src/lib/savings/legChoices.ts` (+ test), `src/components/features/savings-v3/useLegAccount.ts`, `src/components/features/savings-v3/WithdrawSheetV3.tsx`, `src/lib/i18n/dictionaries/en.ts`, `ar.ts`, `src/lib/i18n/types.ts`.
Change: for a pocket with a holder, the "To account" row starts on a "Stays in <holder name>" choice that sends `toAccountId: null` (the store already reads `null` as "deliberately none"); the eligible accounts stay selectable. Under "Spend", when the pocket has a holder, show one muted line: en "Already recorded on <account>? Choose Back to income so it is not counted twice.", plus the Arabic line. Read `docs/DESIGN_SYSTEM.md` first; reuse the row and text primitives already in the sheet, tokens only, no new component. If the existing account row cannot show a "stays" choice without reshaping it, stop and report instead of changing the component.
Failing tests first: `defaultLegAccountId` returns `undefined` for a held pocket even when another tracked account exists; unchanged for a standalone pocket. The sync branch also edits the dictionaries: add keys inside the `wealthSheets.money` block only.

### Slice E — journey test and records (Sonnet). After A-D.
Files: `e2e/journeys/specs/d-pockets.spec.ts`, `e2e/README.md`, `CLAUDE_CONTEXT.md` (one paragraph: the rule of section 2 and the fixed-holder invariant).
Change: one journey with a fresh `qa-e2e-*` user: a tracked account, a pocket held in it, "Spend" from the pocket in the Withdraw sheet → net worth drops by the amount and the account's free amount is unchanged; "Pay a debt" → net worth unchanged. Reuse the seed helpers of the existing pocket journey; list the case in `e2e/README.md`.

Order: **A → B → C**, with **D in parallel** from the start, then **E**. One Sonnet session can run all five in sequence; a second can take D.

## 6. Migration and repair

- **No migration.** 0337 stays free (0336 is the last number on `origin/main` and on every open branch). No column, constraint or function changes, so `database.types.ts` is unchanged.
- **No repair.** Re-check before the push, counts only:

```sql
select count(distinct sa.id) filter (where sa.held_in_payment_method_id is not null) as held_pockets,
       count(st.id) filter (where sa.held_in_payment_method_id is not null
                              and st.kind::text in ('withdraw','withdrawal')) as held_withdrawals
from savings_accounts sa
left join savings_transactions st on st.account_id = sa.id and st.deleted_at is null
where sa.deleted_at is null;
```

Expected today: 1 and 0. If `held_withdrawals` is above 0 by then, nothing needs repairing either (the rule is read-side); tell the owner that those users' net worth will correct itself on the new build.
- **No new query in app code**, so there is nothing to `EXPLAIN`. The adjustment rows of slice C go through the existing sync writer for `account_adjustments`.

## 7. Tests for the cloud qa-runner

Send to the runner (branch `claude/s2-pocket-networth-design-7eb078`, method in `docs/QA_CLOUD.md`):

1. `npx vitest run src/lib/accounts src/lib/savings src/lib/store` (the new and changed unit tests, Cairo).
2. `npm run verify` (the push gate).
3. Journeys: `e2e/journeys/specs/d-pockets.spec.ts` and `s-system-cash.spec.ts` (both read the accounts basis), workers 1.
4. Report: failures with file and line, and confirm 0 `qa-e2e-*` users remain.

## 8. Audit of this plan

Checked against the code, each a place where the design could have double counted or created money:

- `addDebtPayment` writes no expense and no account for a pocket-funded payment, so the debt path gets exactly one leg (the withdrawal).
- The logged-spend expense is skipped by both `balance.ts:83` and `calculateCashOutflow:685`, so there is one leg, not two.
- Income to L: the event credits L (existing) and the withdrawal debits H (new). No double credit, because the tx still carries no `paymentMethodId`.
- A held pocket has its holder's currency (`pocketHolderId`, migration 0318), so the leg needs no gold or FX handling beyond what `apply()` does.
- `account_adjustments.reason` is only stored and synced; nothing branches on `manual_update`, and the rows are ordinary signed deltas, so old and new builds agree on the account after a delete.
- Excluded holder: the pocket is counted on its own and the holder is not totalled, so the extra leg changes nothing in net worth.
- Deleting the paired income event alone turns an income withdrawal into "money left", the same result a standalone pocket gives today.
- Rule order matters: transfer legs have `isCashFlow:false`, so case 3 must come before case 4.

Known limits, accepted:

- **Old builds** compute the old number from the same rows until they update, so during the closed test one user can see two net worths on two builds. It ends with the native build that carries this fix.
- Old builds write withdrawals without `occurredAt`; those legs land at noon, the fallback every older row already has.
- A freeze adjustment is computed on the deleting device; an edit made offline on another device to the deleted pocket's rows is not reflected. Deleting a pocket is rare and the app is single-user.
- The SMS overlap of D3: the hint reduces it, it does not prevent it.

## 9. Out of scope, listed as follow-ups

- A standalone pocket deleted after deposits from an account: its account legs vanish with its rows, so the account gets the money back. Existing behaviour, the same class as slice C; needs an owner decision on what deleting a funded pocket means.
- `pocketUndo` restores rows with their old edit times (S-3 class). It belongs to the sync branch's undo work.
- "Pay an existing expense from a pocket" (linking): the real fix for the SMS overlap.
- A deposit declared into a held pocket (`mode: 'declare'`, money from outside) does not raise the holder's balance.

## 10. Council record

Question: the four decisions of section 4. Voices ran without the session's history.

- **Architect:** D1 adjustments with `manual_update`, D2 stays in holder, D3 accept plus hint, D4 derive only. Main risk named: `manual_update` having a meaning elsewhere (checked: it has none).
- **Skeptic:** same four. Added: derivation is retroactive, so changing a pocket's holder would move past legs. Taken: the fixed-holder invariant in section 2.
- **Pragmatist:** same four. Added: freeze rows must be ordinary signed amounts so old builds agree; old and new builds will differ until updated. Taken: section 8.
- **Critic:** same four. Added: compute the freeze before the rows are removed, in the same store action; pin tests on same-holder moves and corrections, where sign errors are likely. Taken: slices A and C.
- **Strongest dissent:** none on the choices; the shared worry is the retroactive nature of a read-side rule, answered by the fixed-holder invariant and the delete freeze.
