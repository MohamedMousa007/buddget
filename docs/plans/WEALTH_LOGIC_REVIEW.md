# Wealth, Pockets and Goals: logic review

Date: 2026-11-24. Track B of `docs/plans/QA_NIGHT_MASTER_PROMPT.md`. Status: review and proposal. No source or schema was changed.

Evidence rules used here: every claim about behaviour cites `file:line` in this worktree (`claude/qa-bugs-wealth-logic-905035`, head `830fce82`). Line numbers are those of the committed files at that head: other sessions have uncommitted edits in this working tree (among the cited files, `src/lib/accounts/actions.ts` and `src/lib/accounts/resolve.ts`), which shift lines there without changing the cited logic. Where something was not read or cannot be known, it says **not verified**. Live figures are counts only, read on project `tzioppxwsljhlglyducm` on 2026-11-24.

Two facts to hold before reading:

1. **The legacy flow fallback is not dropped in committed code.** `src/lib/savings/netWorth.ts:79-80` still computes `accountsBasis ?? monthlyFlow`. The drop exists only as uncommitted edits in the sibling worktree `.claude/worktrees/linear-tickets-audit-da0ef8` (`accountsBasis ?? 0`, a new `'assets'` snapshot basis, and closed accounts treated as excluded in `netWorthBasis.ts`). Section 5 gives both formulas. The plan in section 9 assumes that change lands first.
2. **The S-2 plan is already implemented.** All eight holder rules are in `src/lib/accounts/balance.ts:121-148`, so the "today" columns of `docs/plans/S2_POCKET_NETWORTH_PLAN.md` are history. "Current behaviour" below comes from the code and its tests only.

---

## 1. Current Business Logic

### 1.1 The objects

| Object | Stored as | What it means in the code |
|---|---|---|
| Account | `payment_methods` row of type cash, bank_account, wallet or prepaid_card (`src/lib/accounts/kinds.ts:8`) | Holds a balance only once it is **tracked**: it has `openingBalance` and `openingAt` and is not provisional (`kinds.ts:33-34`). The balance is never stored; it is derived (`balance.ts:52-173`). |
| Pocket | `savings_accounts` row, category `savings` | A stored number `currentBalance` plus a ledger (`savings_transactions`). It is either **held in** a tracked account (`heldInPaymentMethodId`, `src/lib/store/types.ts:663-670`) or **standalone**. |
| Investment | `investmentHoldings` (table `savings_holdings`), or a pocket with category `investment` | Quantity times a live price, valued in EGP then converted (`netWorth.ts:72-77`). |
| Goal | `goals` row | A target, a date and a funding plan. It holds no money: progress is the sum of its linked pockets, or `manualCurrentAmount` when none is linked (`src/lib/goals/computeGoalProgress.ts:64-73`). |
| Debt | `debts` and `debt_payments` | Remaining amount of debts the user owes; debts owed to the user are left out (`src/lib/utils/monthlyStats.ts:261-269`). |

### 1.2 The one structural rule that exists today

A pocket with a holder is a label on money already inside that account:

- net worth counts the account and skips the pocket (`src/lib/accounts/netWorthBasis.ts:22`, `netWorth.ts:62`);
- the account's free amount is `max(0, balance - held)` (`balance.ts:159-170`);
- the holder is set once at creation and never changed (`types.ts:665-669`).

A pocket with no holder is counted on its own, at its stored balance (`netWorth.ts:61-70`).

Which of the two a pocket becomes is decided by **how it was created**, not by a question to the user:

| Creator | Holder | Evidence |
|---|---|---|
| Wealth > Add > "From an account you already have", account tracked, same currency | that account | `PocketFormSheet.tsx:78`, `:96`; `pocketHolder.ts:9-12` |
| Same path, account not tracked, or the user changes the currency in the form | none (only `linkedPaymentMethodId`) | `pocketHolder.ts:11`; `PocketFormSheet.tsx:64`, `:182` |
| Wealth > Add > "Or start from a kind" (bank, cash, certificate, wallet) | none | `AddHoldingSheet.tsx:73-76`, `PocketFormSheet.tsx:95-96` |
| New goal (client and Buddgy) | none | `src/hooks/useNewGoalForm.ts:217`, `src/lib/buddgy/tools/exec/goals.ts:184` |
| Goal add-money, first deposit with no pocket | none | `GoalAddMoneySheet.tsx:29` |
| Goal funding cron, month-carry cron | primary tracked account | `src/lib/server/allocateGoalFunding.ts:97`, `src/app/api/cron/month-carry/route.ts:142` |
| "Monthly Savings" vault seeded on the device | primary tracked account, if one exists then | `src/hooks/useEnsureMonthlySavingsVault.ts:28` |
| Budget Studio "savings on hand" | asks: in a tracked account (held, capped at free) or elsewhere (standalone); unanswered creates nothing | `src/lib/budget/studioEntities.ts:93-108`, `src/lib/budget/flow/nodes.ts:100` |

Budget Studio is the only place that asks the question the owner's rule depends on.

### 1.3 The two questions the app mixes

Every pocket movement has two independent properties:

- **Budget question:** does it count against this month's left-to-spend? Stored as `isCashFlow` (`useFinanceStore.ts:1830-1833`).
- **Location question:** was the money already inside a tracked account, or did it come from outside everything tracked? Stored only implicitly, as the account leg `paymentMethodId` on the row (`useFinanceStore.ts:1817-1819`, `:1835`).

The add-money sheet asks only the budget question ("This month's budget" / "Outside the budget", `AddSavingsSheetV3.tsx:87-98`, `en.ts:3645-3649`). Under the accounts basis, net worth moves or not according to the account leg, which the user never chose knowingly. That mismatch is the root of most findings in section 6.

---

## 2. Current User Journey

### 2.1 Create a pocket (Wealth > Add holding > Pocket)

1. Chooser (`AddHoldingSheet.tsx:99-149`): a list of existing payment methods that hold money (bank, wallet, prepaid, debit card; `:23`, `:69`), then four kinds (bank, cash, certificate, wallet; `:22`). An account that already has a pocket is disabled (`:109`), so one account can back only one pocket through this path.
2. Form (`PocketFormSheet.tsx`): provider, last 4, maturity, name, "In it now", currency, colour.
   - From a tracked account: the amount is capped at the account's free money (`:78-80`, `:174-178`) and the pocket is held in it.
   - From a kind: no cap, no holder. The opening amount is written as a deposit with `isCashFlow: false` (`useFinanceStore.ts:1706-1722`) and raises net worth by that amount.
3. The toggle "Also a payment method" (`PocketFormSheet.tsx:66`, `:194-196`) is never read by `create()` (`:82-100`). It does nothing.

Nothing in this journey asks whether the money is already in a tracked account. Gold, stocks, crypto and property are on a separate tab and become investment holdings, not pockets (`AddHoldingSheet.tsx:30-35`, `:150-160`).

### 2.2 Add money

- Wealth > Add money (`AddSavingsSheetV3.tsx`): pocket, amount, "Where it came from" (budget or outside), and, for budget only, a "From account" row (`:100`).
  - Budget: `depositToSavings(..., { mode: 'allocate', fromAccountId })`. The leg is the picked account, else the primary tracked bank or wallet, and only if it is tracked, open, same currency and not the pocket's own holder (`accountLeg.ts:13-38`). No valid leg means no leg, silently (`AccountLegRow` renders nothing, `MoneySheetParts.tsx:130-131`).
  - Outside: `mode: 'declare'`, `isCashFlow: false`, no leg (`useFinanceStore.ts:1817-1819`, `:1833`).
- Accounts > account > Set aside (`MoveMoneySheet.tsx`): capped at free (`:49`); says "Stays in this account" when the pocket is held in that account, "Moves out of the account" otherwise (`:50`, `:80`). Written as `mode: 'declare'` with an explicit `paymentMethodId` (`actions.ts:68-70`).
- Goal > Add money (`GoalAddMoneySheet.tsx:32`): always budget mode, from the primary account.
- Automatic: month-end carry and goal funding post a deposit with `source: 'carry'` and the primary account as leg (`route.ts:166-169`, `src/lib/server/pocketLedger.ts:26-30`).

### 2.3 Take money out (Wealth > Withdraw)

Five purposes (`WithdrawSheetV3.tsx:48-54`): Spend, Pay a debt, Invest, Back to income, Move to another pocket. The only cap is the pocket's own balance (`:112`, `:211`), so a withdrawal is allowed when the holding account's free amount is zero.

- Back to income from a held pocket defaults to "Stays in <account>" (`:336-343`, `withdrawDestination.ts:7-14`): pocket down, an income event with no account is written (`useFinanceStore.ts:1937-1956`), the account does not move (`balance.ts:145-146`). This is the existing "release".
- Every other exit from a held pocket debits the holder (`balance.ts:147`). Exits from a standalone pocket move no account, except Back to income into a chosen account (the income event carries the leg).
- Spend can also log an expense. It is written on the Cash sentinel and skipped by the balance engine through `fundedFromSavingsTxId` (`WithdrawSheetV3.tsx:180-185`, `balance.ts:85`).

### 2.4 Create a goal

`StepMakeItReal.tsx:137-139` asks "Already saved" (optional). On save (`useNewGoalForm.ts:209-221`): the goal is created, a new standalone vault named after it is created and linked, and "Already saved" is deposited as declared money (`mode: 'declare'`, `source: 'goal_opening'`). Net worth rises by that amount in every case. There is no "it is in my bank" choice. Buddgy's `add_goal` does the same (`buddgy/tools/exec/goals.ts:184-187`).

Deleting a goal asks whether to keep its pocket or move the money to another pocket (`DeleteGoalSheet.tsx:26-38`); the goal row itself carries no money.

### 2.5 Wealth calculation as the user sees it

- Wealth hero (`SavingsHero.tsx:55`, `:65-66`): big number "What you hold", small number "Net worth".
- Accounts hero (`AccountsHero.tsx:37`, `:53-54`, `:76-80`): big number "Available now", small number "Net worth", cells "In accounts", "Set aside", "Credit owed".
- Three different engines produce these (section 5).

---

## 3. Problems and Confusion

P1. **The app asks the wrong question.** It asks the budget question and derives the location answer from the account leg. The owner's critical rule (existing money never changes net worth; external money raises it once) is a location rule. Evidence: 1.3.

P2. **"What you hold" is smaller than "Net worth" for an ordinary user.** "What you hold" sums pockets and holdings, includes held pockets, and excludes account balances (`wealthModel.ts:75-87`, `:115`; `wealth/page.tsx:240`, `:275`). Net worth includes accounts and excludes held pockets. Worked example in 5.4: hold 110,000, net worth 170,000.

P3. **A pocket's home is invisible.** The Wealth list shows a held pocket and a standalone pocket identically (`wealthModel.ts:86`). The user cannot tell which pockets are labels on bank money and which are separate money.

P4. **Goals and pockets follow different rules.** Client-created goal pockets are standalone; server-created ones are held in the primary account (1.2). "Already saved" is always external.

P5. **Two creation paths that look alike give opposite accounting.** "CIB" picked from the account list is an earmark; "Bank account" picked from the kinds grid and named CIB is new money.

P6. **Reserved money can exceed the account and nothing says so.** Only two of the five writers cap at free (`PocketFormSheet.tsx:80`, `MoveMoneySheet.tsx:49`). After that, spending can take the balance below the reserved total; free clamps to zero (`balance.ts:169`) and the pocket keeps showing the full amount.

P7. **"Available now" on the hero is not the sum of the rows under it.** The hero subtracts all held from all balances, then clamps (`AccountsHero.tsx:26`); each row clamps per account (`balance.ts:169`).

P8. **Words.** "Set aside" (accounts), "pocket", "vault", "earmark" (code), "Stays in this account", "Outside the budget", "Back to income" are six phrasings around two ideas. Arabic uses `مُخصَّص`, `جيب`, `خارج الميزانية`, `العودة إلى الدخل` (`ar.ts:312`, `:1201`, `:3660`, `:3657`).

P9. **Release is booked as income.** Releasing reserved money writes a confirmed income event named "Withdrawal from <pocket>" (`useFinanceStore.ts:1938-1956`). Whether the income KPI hides `sourceType: 'savings'` events: **not verified**.

P10. **Dead control.** "Also a payment method" (2.1 step 3).

P11. **A positive bank gap is presented as missing money.** The row and the sheet use the absolute value (`AccountRow.tsx:31-35`, `FixGapSheet.tsx:45`) and every answer subtracts from the account (`FixGapSheet.tsx:88-96`). When the bank shows more than the ledger, the sheet pushes the ledger further away.

---

## 4. Data Model Review

Columns from `src/lib/supabase/database.types.ts`; live counts 2026-11-24.

| Table | Wealth-relevant columns | Notes | Live |
|---|---|---|---|
| `payment_methods` | `type`, `currency`, `opening_balance`, `opening_at`, `closed_at`, `excluded`, `provisional`, `parent_id` | Tracked = opening pair set and not provisional. Added by `0150_accounts_core.sql`. The 0150 guard turns a delete into a close only when expenses, income or debt payments reference it; pockets held in it are not in that check (`0150:29-36`); the client check does include them (`removePaymentMethod.ts:15`). `0203_b3_account_erasure_fks.sql` has no reference to `savings_accounts` (grep); its effect on account deletion was not read further: **not verified**. | 35 tracked accounts, 12 of 55 users |
| `account_adjustments` | `payment_method_id`, `delta`, `reason` (`manual_update`, `gap`, `opening_correction`), `occurred_at` | Signed deltas, synced (`0152_balance_reports_adjustments.sql`). | 13 |
| `account_balance_reports` | `payment_method_id`, `balance`, `reported_at`, `sms_parse_log_id` | Server-written from bank SMS. Never changes a balance by itself; the device compares it with the ledger (`useAccountGaps.ts:45-58`). | 22 |
| `savings_accounts` | `category`, `type`, `currency`, `current_balance`, `opening_balance`, `linked_payment_method_id`, `held_in_payment_method_id`, `is_emergency_cover`, `metadata` | `held_in` added in `0151_ledger_links.sql:11` with `ON DELETE SET NULL`; backfilled once by `0318`; cross-tenant guard in `0244:27`. No constraint ties `held_in` to the account's currency or type. `current_balance` is derived on the server from ledger deltas when the switch in `0227_final_savings_balance_delta.sql` is on (switch state: **not verified**). | 34 pockets, 22 users; 2 held; 19 standalone with money; 18 vaults; 0 investment-category |
| `savings_transactions` | `account_id`, `kind`, `amount`, `currency`, `is_cash_flow`, `payment_method_id`, `transfer_group_id`, `source`, `occurred_at` | The withdrawal purpose is not stored (S-2 D4). `source` is free text (`carry`, `transfer`, `goal_opening`). | 33 rows; 5 with an account leg; 22 with `is_cash_flow = false`; 0 `goal_opening` |
| `savings_holdings` | `asset_type`, `quantity`, `unit_cost`, `cost_basis_currency`, `account_id` | Backs `investmentHoldings`. `account_id` is a nullable link to a pocket; its use in the app: **not verified**. | 0 |
| `goals` | `target_amount`, `currency`, `manual_current_amount`, `linked_savings_account_ids[]`, `linked_debt_ids[]`, `funding_mode`, `share_pct`, `monthly_contribution` | An array link, so one pocket can be linked to two goals and each counts the whole pocket (`computeGoalProgress.ts:68-73`). | 10 goals; 3 linked to pockets; 0 with a manual amount |
| `goal_allocation_runs`, `savings_month_summary` | idempotency and history for the crons | Not changed by this plan. | not counted |
| `net_worth_snapshots` | `day`, `net_worth`, `currency`, `basis` | One row per user per day (`useDailyNetWorthSnapshot.ts:28-30`). The trend only compares rows of one basis. | not counted |
| `debts`, `debt_payments` | `direction`, `debt_type`, `linked_payment_method_id`, `funded_from_savings`, `funded_from_savings_tx_id`, `payment_method_id` | A pocket-funded payment has no account of its own; the pocket withdrawal is the leg (`balance.ts:104`). | not counted |
| `income_events` | `status`, `payment_method_id`, `linked_savings_account_id`, `received_date` | Only received events with an account move a balance (`balance.ts:95-98`). | not counted |

Gaps in the model:

1. No field says where an **outside** pocket's money is, beyond `type` (bank, cash, vault, other). A standalone pocket of type `bank` is exactly the shape of a double count.
2. No server rule keeps `held_in` valid (same currency, a balance-holding type, tracked).
3. `linked_payment_method_id` without `held_in` has no accounting meaning but looks like a link. Live: 3 such pockets, 1 of them linked to a tracked account in another currency.
4. `goals.manual_current_amount` is unused for savings goals (0 live rows above zero) but still read (`computeGoalProgress.ts:65`, `allocateGoalFunding.ts:49`).

---

## 5. Calculation Review

### 5.1 Net worth

Committed code (`netWorth.ts:52-104`, `useNetWorth.ts:25-85`, `netWorthBasis.ts:7-24`):

```
accountsBasis   = sum over tracked, non-excluded accounts of balance, converted to base
                  (an account with no FX rate is left out and the result is flagged incomplete)
                  absent when no account is tracked
heldInPocketIds = pockets whose holder is tracked and not excluded

totalSavings     = sum of savings-category pockets NOT in heldInPocketIds, in base
totalInvestments = sum of investment-category pockets NOT in heldInPocketIds
                   + investment holdings (valued in EGP, converted to base)
debtRemaining    = remaining on debts the user owes, non-excluded methods

netWorth = totalSavings + totalInvestments
         + (accountsBasis if any account is tracked, else receivedIncome - cashOutflow of the current cycle)
         - debtRemaining
```

Sibling worktree, uncommitted (the owner's 2026-11-24 decision): the same, with `(accountsBasis ?? 0)` and closed accounts added to the excluded set. With no tracked account, net worth is pockets plus investments minus debt; with no pockets either it is zero or negative.

Account balance (`balance.ts:52-173`), per tracked account, counting only rows after its opening instant (`:69`):

```
balance = openingBalance
        - expenses paid from it (net of refunds; pocket-funded and refunded expenses skipped; an unplaced SMS
          expense or an unfunded CC payoff skipped)                                   (:83-93)
        + expenses whose destination it is (transfers, cash-out)                      (:92)
        + received income events that name it                                         (:95-98)
        -/+ debt payments that name it and left no expense (+ for money owed to the user)  (:100-110)
        +/- pocket rows by the eight holder rules                                     (:121-148)
        + account adjustments                                                         (:150-153)
```

### 5.2 What you hold

`wealth/page.tsx:122-125`, `:240`; `wealthModel.ts:68-122`:

```
whatYouHold = sum of ALL pockets (held and standalone, savings and investment), in base
            + sum of investment holdings, in base
```

Account balances are not in it. Held pockets are in it. Unpriced rows are left out and the figure is prefixed "at least".

### 5.3 Available now

`AccountsHero.tsx:26`; `useAccounts.ts:57-77`:

```
availableNow = max(0, totalInBase - heldInBase)
totalInBase  = sum of balances of set-up, non-excluded, tracked accounts, in base
heldInBase   = sum of held-pocket totals of those accounts, in base
```

Per account row: `free = max(0, balance - held)` (`balance.ts:169`). The two disagree when one account is over-reserved: A balance 20,000 with 30,000 held, B balance 50,000 with nothing held; rows show 0 and 50,000, the hero shows 40,000.

Closed accounts: left out of the Accounts list and of `totalInBase` (`useAccounts.ts:59`, `kinds.ts:39`) but still inside `accountsBasis` in committed code (`netWorthBasis.ts:11` filters `excluded` only). A closed account with a balance is therefore in net worth and nowhere on screen.

### 5.4 One state through the three engines

CIB 100,000 tracked. Pocket Trip 30,000 held in CIB. Pocket "Cash at home" 20,000 standalone. Gold holding 60,000. Card debt 10,000.

| Figure | Value | How |
|---|---|---|
| What you hold | 110,000 | 30,000 + 20,000 + 60,000 |
| Net worth | 170,000 | 100,000 + 20,000 + 60,000 - 10,000 |
| Available now | 70,000 | 100,000 - 30,000 |
| In accounts / Set aside | 100,000 / 30,000 | Accounts hero cells |

Nothing here is double counted, but the three labels do not add up for a reader: what you hold is less than net worth, and the 20,000 outside pocket is in neither "In accounts" nor "Set aside".

---

## 6. Double Counting Risks

Tags: **DC** counted twice, **ML** money lost or under-counted, **DR** drift between the app and reality that later becomes one of the two. "Basis" means a tracked account exists (or the assets basis of the sibling worktree).

### Pockets and accounts

**DC-1. Goal "Already saved" while the money is in a tracked account.** CIB 100,000. New goal Car, already saved 30,000. A standalone vault gets 30,000 as declared money. Net worth 130,000; correct 100,000. Path: `useNewGoalForm.ts:217-220`; `buddgy/tools/exec/goals.ts:184-187`; `netWorth.ts:61-70`.

**DC-2. Pocket created from a kind while that money is in a tracked account.** CIB 100,000 tracked. Add pocket > Bank account > "Emergency" 30,000. Net worth 130,000. Path: `AddHoldingSheet.tsx:73-76`; `PocketFormSheet.tsx:84-97`; `useFinanceStore.ts:1706-1722`. Same shape for a Cash pocket of 20,000 next to a tracked Cash account that already includes it. Live: 12 standalone pockets with money belong to 6 users who also track accounts; 6 of the 12 are type `bank`. How many are real duplicates cannot be known from data.

**DC-3. Pocket from an account, currency changed in the form.** CIB is EGP. In the form the user switches the currency to USD and enters 600. `pocketHolderId` returns undefined on the currency mismatch, the free cap disappears, and the pocket is saved with `linkedPaymentMethodId` only. Net worth +600 USD. Path: `PocketFormSheet.tsx:64`, `:78-80`, `:182`; `pocketHolder.ts:11`. Live: 1 pocket.

**DC-4. Pocket from an untracked account; the account is tracked later.** Pocket 30,000 from NBE, which has no balance yet, so the pocket is standalone. Later the user sets NBE to 100,000. Net worth 130,000. Path: `pocketHolder.ts:11`; `actions.ts:11-13` (setting a balance touches no pocket); `0318` was a one-off backfill. Live: 2 pockets carry a link to a method that is not a tracked balance account (untracked, a card, or deleted: not broken down).

**DC-5. "This month's budget" deposit with no valid account leg.** EGP salary account 100,000; a USD pocket. Add 500 USD from this month's budget. No account has the pocket's currency, so no leg is written and no row is shown for it. Pocket +500 USD, no account moves, net worth +500 USD. Path: `accountLeg.ts:13-22`, `:29-38`; `useFinanceStore.ts:1817-1819`; `MoneySheetParts.tsx:130-131`; `balance.ts:135`. Same result for a gold pocket.

**ML-1. Outside money declared into a held pocket.** CIB 100,000, Trip 30,000 held. A 20,000 gift is added as "Outside the budget". Trip becomes 50,000, CIB stays 100,000, free drops to 50,000, net worth stays 100,000. If the gift is real new money, net worth is 20,000 short; if it is in CIB already, the account balance is 20,000 short. Either way reserved can now exceed the balance. Path: `useFinanceStore.ts:1817-1819`, `:1833`; `balance.ts:142`; `netWorth.ts:62`. Listed as an open follow-up in S-2 section 9.

**ML-2. Editing a held pocket's amount.** Edit pocket > amount 80,000 on a pocket held in a 50,000 account. Written as a correction with no leg and no cap. Path: `EditSavingsAccountSheet.tsx:88`; `useFinanceStore.ts:2015-2047`; `balance.ts:142`.

**ML-3. Spending erodes reserved money.** CIB 100,000, Trip 30,000 held. Card and SMS spending of 85,000 brings CIB to 15,000. Free shows 0, Trip still shows 30,000, "What you hold" still includes 30,000, "Set aside" shows 30,000 against 15,000 "In accounts". Net worth is right (it counts 15,000) but the pocket shows 15,000 that does not exist. Path: `balance.ts:159-170`; `wealthModel.ts:75-87`; `AccountsHero.tsx:76-80`. Bank SMS balance reports never change the ledger themselves (`0152`; `useAccountGaps.ts:45-58`), so the erosion always comes through expenses, cash-outs or adjustments.

**DR-1. A label move booked as a transfer.** The user's default carry pocket is standalone. Month-end carry of 5,000 debits the primary account and credits the pocket (`route.ts:166-169`; `pocketLedger.ts:26-30`; the RPC stores the account on the row, `0198_savings_rpc_v2.sql:75-76`; `balance.ts:126-133`). Net worth is unchanged, but the bank still has the 5,000, so the ledger is now 5,000 below the bank. Same for goal funding into a client-created goal vault (`allocateGoalFunding.ts:106-109`) and for Goal > Add money (`GoalAddMoneySheet.tsx:32`). Then:
- the user taps Update balance and types the bank figure: +5,000 adjustment (`actions.ts:73-83`), net worth +5,000 (**DC**); or
- two bank reports arrive and the gap sheet says 5,000 is "missing"; "I spent it" subtracts another 5,000 (`FixGapSheet.tsx:45`, `:88-96`), net worth -5,000 (**ML**).

**DR-2. Deleting a standalone pocket that was funded from an account.** The rows go, their account legs go, and the account gets the money back (S-2 section 9; `useFinanceStore.ts:1739-1774` freezes only held pockets, `:1759`). Net worth is unchanged, which is right only if the money really was still in the bank.

**DR-3. Withdrawing from a standalone pocket to nowhere.** No tracked account or no same-currency account: "Back to income" writes an income event with no account (`useFinanceStore.ts:1937`, `:1951`). Pocket -5,000, nothing +5,000. Under the assets basis net worth -5,000 while the cash is in the user's hand. Under the legacy basis the income term covered it.

### Account lifecycle

**ML-4. Closing an account that holds pockets.** Committed code: the closed account stays in `accountsBasis` and its pockets stay skipped, but the account is hidden (5.3). Sibling worktree: the closed account leaves the total and its pockets are counted on their own again, so closing CIB (100,000, Trip 30,000 held) turns net worth from 100,000 to 30,000. The close dialog asks nothing about the balance or the pockets (`AccountDetailSheet.tsx:76-82`).

**ML-5. Excluded account.** A pocket held in an excluded account is counted on its own and the account is not (`netWorthBasis.ts:11`, `:22`). Consistent with zakat (`zakatAccounts.ts:10-16`) and pinned by a test (`pocketEarmarkNetWorth.test.ts:70`). Marking CIB excluded therefore removes 70,000 and keeps 30,000. Deliberate today, but it contradicts "a reserved pocket is part of its account": decision D11.

**DC-6. System Cash.** Every user has one Cash account, untracked until asked once (`docs/SYSTEM_CASH_PLAN.md`). A cash pocket of 20,000 created before the user answers "How much cash do you have right now?" with 25,000 (which includes it) is counted twice: same shape as DC-2. Expenses paid from an untracked Cash reduce nothing; that is the accepted meaning of "untracked".

### Investments

**DC-7. Holding bought with account money.** Add holding > Gold, 10 g worth 60,000, paid by bank transfer that produced no expense in the app. The holding adds 60,000 (`useFinanceStore.ts:1668-1675`), CIB stays 100,000. Net worth +60,000; correct 0. The asset form has no "paid from" field (`AssetFormSheet.tsx:40`). If the purchase was captured by SMS as an expense, net worth is right but the month shows 60,000 of spending. Live: 0 holdings.

**OK-1. Invest from a pocket.** Withdrawal plus quantity added to the holding (`WithdrawSheetV3.tsx:165-175`); a held pocket debits its holder (`balance.ts:147`). One movement each side.

**DR-4. Price and FX.** Holdings and outside pockets in other currencies or gold change net worth with the market. That is correct, but the reserved total of a held pocket in another currency than its account would also float (`balance.ts:163`). Creation forbids it (`pocketHolder.ts:11`); an empty held pocket whose currency is edited later is not blocked (`EditSavingsAccountSheet.tsx:84`; lock applies only once it has rows, `:45`).

### Debts, credit cards, BNPL

**OK-2. Credit card purchase.** A card moves no account (`resolve.ts:33-46`); the purchase raises the card debt once. Whether every credit card always has a debt row so that its spending reaches net worth under the accounts basis: **not verified** (the guard in `calculations.ts:661-676` protects the legacy flow term only).

**DR-5. Card payoff or SMS expense with no account.** A 5,000 payoff the resolver could not place lowers the debt and debits no account (`balance.ts:86-88`). Net worth +5,000 until the user attaches it. An unplaced SMS purchase debits nothing either (`balance.ts:91`). Described as RC4 in `docs/ACCOUNT_BALANCE_ACCURACY_PLAN.md`.

**OK-3. Debt paid from a pocket.** One leg: the pocket withdrawal (`balance.ts:104`, `:147`); the logged expense, if any, is skipped (`balance.ts:85`, `calculations.ts:685`).

**BNPL: not verified.** The balance engine has no BNPL branch (`balance.ts`, `resolve.ts:33-46`: a BNPL method moves no account), so a purchase should reach net worth only through its installment debt and each installment through a debt payment that names an account. The debt-side code (`calculateDebtRemaining`, the installment writers) was not read for this review, so no claim is made that each event is counted once.

**DR-6. Money owed to the user.** Lending 5,000 from CIB lowers the account; the receivable is not an asset (`monthlyStats.ts:261-269`). Net worth -5,000 until repaid (`balance.ts:107`). Conservative, never a double count; a product decision (section "Decisions for council"). **Fixed 2026-11-24 (migration 0348):** the claim was not true when written, since creating a debt moved no account and only the repayment did (+5,000 from nothing). A new personal debt through a tracked account now asks whether the money moved and stores a principal leg on the debt row (`debts.principal_*`, `balance.ts`); a bank transfer that already booked it is linked instead (`src/lib/debts/principalLeg.ts`). Debts created before the fix keep no leg.

### Income

**OK-5. Pending, expected and auto-detected income.** Only `confirmed`, `late` and `partial` events with an account move a balance (`balance.ts:39`, `:95-98`). Income with no account is ignored under the accounts basis: a salary logged by hand with no account never reaches net worth (**ML** by omission; shown to the user nowhere). SMS credits on a provisional account stay out until the user confirms the account and sets a balance (`kinds.ts:33-34`); rows before the opening instant are ignored (`balance.ts:69`), so they cannot be counted twice.

**DR-7. Release booked as income.** See P9. Releasing 600 inside the holder adds a 600 income event; net worth is unaffected (`balance.ts:145-146`) but the month's income and left-to-spend may rise. Effect on the income KPI: **not verified**.

### Goals

**DC-8. One pocket linked to two goals.** Both goals count the whole pocket (`computeGoalProgress.ts:68-73`). Goal progress is doubled; net worth is not.

**DR-8. Goal pockets with two different homes.** Client-created: standalone. Server-created: held in the primary account (1.2). The same monthly funding is a transfer out of the bank for one user and a label for another.

### Legacy flow (committed code only)

**DC-9.** With no tracked account, net worth adds this cycle's received income minus cash outflow (`netWorth.ts:79-80`). The surplus leaves net worth when the cycle rolls over unless the carry banked it, and the first tracked account replaces the term in one step. Removed by the sibling worktree's change.

---

## 7. Simplified Proposed Experience

### 7.1 One idea, two homes

A pocket is a purpose. Its money has exactly one home:

- **Inside an account** (reserved): the money is part of that account's balance. English "Set aside in CIB". Arabic `محجوز في CIB`.
- **Outside your accounts**: cash at home, a certificate, a wallet or a bank the user does not track here, gold, and so on. English "Kept outside your accounts". Arabic `خارج حساباتك`.

The user answers one question, in plain words, whenever money enters a pocket or a goal: **"Where is this money?"** / `الفلوس دي فين؟` (or `أين هذا المال؟` on MSA screens).

### 7.2 Three labels, one sentence each

| Label | Arabic | Definition shown under an info tap |
|---|---|---|
| What you hold | `كل ما تملكه` | Everything you own that buddget can see: your account balances, money kept outside them, and investments at today's price. |
| Net worth | `صافي ما تملك` (keep `صافي الثروة` if the owner prefers) | What you hold minus what you owe. |
| Available now | `المتاح للصرف الآن` | Money in your accounts that is not set aside in a pocket. |

Identity the screens must satisfy: **What you hold = Available now + Set aside in accounts + Kept outside accounts + Investments.** On the Wealth hero the bar can draw any number of segments (`SavingsHero.tsx:79-81`) but the band has three cells (`:96`). So the hero shows three: **Available**, **In pockets** (set aside in accounts plus kept outside) and **Investments**; the pocket list carries the inside/outside split. A fourth cell would be a change to `HeroBand` and is not proposed (it would need the owner's go-ahead under the reuse rule).

### 7.3 Create a pocket: three steps

1. **Name it.** One field with suggestion chips (Emergency, Car, Travel, General savings). The name preselects the likely home (for example "ذهب" or "Gold" preselects Gold) using a keyword list; no AI call.
2. **Where is the money?** One list, built from `SelectableCard`:
   - the user's accounts, each with "X available" (tracked) or "balance not set" (untracked);
   - "Add an account";
   - Cash at home; Bank certificate; Mobile wallet; Gold; Stocks; Crypto; Property; Other;
   - "Nothing yet, I'll fill it later".
3. **How much?** Only the fields that home needs:

| Home | Fields | Effect |
|---|---|---|
| Tracked account | amount, capped at available | Reserved. Net worth unchanged. Line under the field: "Stays in CIB. Available becomes 70,000." |
| Untracked account | "How much is in this account now?" then amount | The account becomes tracked, then as above. |
| Cash at home, wallet not tracked, other | amount, currency | Outside. Net worth rises. Line: "Adds 20,000 to what you hold." |
| Certificate | bank, amount, maturity date, yearly return | Outside. |
| Gold, stocks, crypto, property | the existing asset form | Investment linked to the pocket. |
| Nothing yet | none | Empty pocket; its home is asked on the first deposit. |

No "This month's budget / Outside the budget" question here: an opening amount is money the user already has, so it never touches the month.

### 7.4 Pocket detail and list

Each row and the detail header carry one muted sub-line: "In CIB" / `داخل CIB` or "Outside your accounts" / `خارج حساباتك`. A pocket whose account can no longer cover it shows an amber line: "CIB has 15,000, 30,000 is set aside here. Release 15,000 or top up." Two buttons: Add, Take out.

### 7.5 Add and take out

Add:
- Reserved pocket: "Set aside from CIB (70,000 available)". One amount field, capped. Nothing else.
- Outside pocket: "Where is it coming from?" with two choices: "From my account" (pick; the account goes down, net worth unchanged) or "New money" / `فلوس جديدة` (net worth goes up).

Take out, three choices instead of five tiles at first level:
- **Release** / `رجّعها للمتاح`: back to available. Reserved pocket: nothing moves, available rises; always allowed up to the pocket amount, also when available is zero. Outside pocket: asks which account receives it, or "Cash in hand".
- **Use it** / `استخدمها`: opens Spend, Pay a debt, Invest (the current tiles).
- **Move to another pocket** / `انقلها لجيب آخر`.

### 7.6 Goals

Same rules, different purpose. A goal is a target and a date on top of one or more pockets.

- New goal, "Already saved": after the amount, the same "Where is this money?" list plus "In a pocket I already have" (links it; no new money).
- Goal card shows "30,000 of 200,000 · in CIB".
- Automatic monthly funding goes to a pocket reserved in the primary account, on the device and on the server alike.

---

## 8. Business Rules

Terms: `A` = sum of balances of tracked, counted, open accounts. `Rsv(a)` = sum of pockets held in account `a`. `O` = sum of pockets that have no holder (plus, until decision D11 is taken, pockets whose holder is excluded, as today). `I` = investments at market value. `D` = debts the user owes. All in base currency.

- **R1. Net worth.** `NW = A + O + I - D`. A held pocket is never a term. With nothing tracked and no pockets, `NW = -D`.
- **R2. What you hold.** `Hold = A + O + I`, so `NW = Hold - D`.
- **R3. Available now.** `Avail = sum over accounts of max(0, balance(a) - Rsv(a))`. The hero equals the sum of the rows.
- **R4. Identity.** `Hold = Avail + sum over accounts of min(balance(a), Rsv(a)) + O + I`.
- **R5. Reserving never changes net worth.** Any add to a pocket held in account `a`, from `a` itself: `NW`, `A` and `balance(a)` unchanged; `Avail` falls by the amount. From another tracked account `l`: `balance(l) -x`, `balance(a) +x`, reserved `+x`, `NW` unchanged (today's rule 1, `balance.ts:126-133`).
- **R6. Reserve cap.** A reserve from `a` is refused when it exceeds `max(0, balance(a) - Rsv(a))`. Every writer enforces it: pocket form, add-money sheet, set-aside sheet, goal sheets, Buddgy, AI handler, pocket edit. The crons clamp to it and report the remainder.
- **R7. Over-reserved state.** When spending, an SMS expense or an adjustment makes `balance(a) < Rsv(a)`: no pocket is changed silently; `Avail` for `a` is 0; `NW` uses `balance(a)`; the account and its pockets show the shortfall `Rsv(a) - balance(a)` until the user releases or tops up. New reserves in `a` are refused while it lasts.
- **R8. Release is always allowed.** Releasing `x` from a held pocket with `0 < x <= pocket balance` succeeds whatever `Avail` is. Effects: pocket `-x`, `Rsv(a) -x`, `balance(a)` and `NW` unchanged, shortfall falls by up to `x`.
- **R9. External money is counted once.** Adding `x` of new money to an outside pocket: `O +x`, `NW +x`, no account moves. Deleting that row reverses exactly `x`.
- **R10. External money cannot enter a reserved pocket directly.** A deposit into a reserved pocket that names no account and is not a reserve of the holder's own money is refused. Money that arrived in the account is recorded on the account (income, transfer in, or Update balance) and then reserved. This closes ML-1. The Accounts "Set aside" action is not affected: it names its account (`actions.ts:68-70`).
- **R11. Account to outside pocket is a transfer.** `balance(a) -x`, `O +x`, `NW` unchanged; capped at `Avail(a)`. The reverse (outside pocket to account) is the mirror.
- **R12. Leaving the system.** Spend, debt payment or investment from a reserved pocket: pocket `-x`, `balance(a) -x`; `NW -x` for spend, unchanged for debt (`D -x`) and investment (`I +x`). From an outside pocket: `O -x` and the same right-hand sides. Exactly one row carries the account effect.
- **R13. Pocket to pocket.** `NW` unchanged. Same holder: no account moves. Different homes: the money crosses, so `balance` moves by `x` on each tracked side.
- **R14. One home per pocket, fixed.** A pocket's home is set when its first money arrives and does not change. Changing it is one explicit action, `convertPocketHome`, with this contract when an outside pocket becomes reserved in account `a`: (i) rows with no account leg are simply no longer counted on top, so `NW` falls by exactly that amount (the double count being removed); (ii) rows that had debited `a` to fund the pocket stop debiting it, so `balance(a)` rises by their net and `NW` is unchanged; (iii) every other change the new holder would derive from past rows (old spends, moves, legs against other accounts) is cancelled by a freeze adjustment, so no other balance moves; (iv) the user is shown `a`'s resulting balance and asked to confirm it against the bank, because an earlier manual correction of the same money cannot be detected. A blanket freeze of every change is wrong: in case (ii) it would subtract the money a second time.
- **R15. Currency.** A reserved pocket has its account's currency. A cross-currency move stores both amounts at the time of the move; no leg is ever implied 1:1. A value with no rate is left out of totals and the total is marked "at least", never counted at face value.
- **R16. A row that claims to come from an account must debit one.** If no valid account leg exists, the sheet says so and offers "New money" or cancel. No silent leg-less budget deposit (closes DC-5).
- **R17. Goals follow pockets.** A savings goal's progress is the sum of its linked pockets; a goal holds no amount of its own. "Already saved" creates or links a pocket under R5 or R9. A pocket belongs to at most one active goal.
- **R18. Automatic funding is a reserve.** Month-end carry and goal funding reserve inside the primary account when one is tracked (R5, clamped by R6). They never debit an account for money that did not leave it (closes DR-1).
- **R19. Deleting a pocket.** Reserved: the reservation ends, balances stay as they are (freeze adjustments for past exits, as today). Outside with money: the user says where it went (to an account, spent, or no longer mine); the default removes `x` from `O` and `NW`.
- **R20. Closing or excluding an account.** Closing is refused while `Rsv(a) > 0` until the user releases or moves those pockets. A closed account is in no total. Excluding an account: its balance leaves every total; whether its reserved pockets leave with it or stay counted on their own (today) is decision D11.
- **R21. Tracking an account for the first time.** When an account gets its first balance and outside pockets exist that could be the same money (linked to it, or of a matching kind and currency), the user is asked once per pocket whether it is inside that balance. Yes makes it reserved through `convertPocketHome` (R14). Answered in the same step as the opening balance, no past row is after the opening instant, so cases (ii) and (iii) are empty; answered later, they apply in full. Unanswered leaves it as it is.
- **R22. Investments.** A new holding asks "Bought now from an account" (account `-x`, `I +x`, `NW` unchanged) or "I already own it" (`I +x`, `NW +x`).
- **R23. Budget effect is derived, not asked.** Money reserved or moved from an account during the month counts as saved this month; opening amounts, new outside money and releases of older savings do not change the month's income total. (Depends on decision D3.)
- **R24. Bank reports.** A balance report never changes a balance or a pocket. A gap is signed: "the bank shows X more" and "the bank shows X less" offer different answers.

Each rule maps to at least one unit test in section 9.

---

## 9. Implementation Plan

Assumptions: the sibling worktree's assets-basis change merges first. Migration numbers are "next free at merge time": this worktree's last file is `0344_ai_free_failure_cap.sql`, and the sibling worktree already has a different `0344_user_devices_install_key.sql`, so the two collide and must be renumbered before either lands. Deep-technical rule applies: tests are written with each slice and run when the owner asks. UI steps normally wait for a mockup approval; the QA-night prompt waives mockups for that run only.

Reused components throughout: `HeroBand`, `ModalShell` + `V3SheetHeader`, `SelectableCard`, `OptionChip`, `SegmentedControl`, `AmountField`, `CurrencyField`, `AccountPicker`, `AccountLegRow`, `PocketPickerField`, `SheetBody`/`SheetFooter`, `StatusPill`, `Badge`, `CardActionMenu`, `Button size="cta-block"`. No new component is needed and none is reshaped; the home list is a composition of `SelectableCard`.

### Phase 0: stop new wrong numbers (no migration)

| Item | Change | Files | Closes |
|---|---|---|---|
| 0.1 | One helper `pocketHome(pocket, methods)` returning `{ kind: 'reserved', accountId } \| { kind: 'outside' }`, and `availableIn(accountId)`. Every writer and screen uses it. | new `src/lib/savings/pocketHome.ts`; callers of `heldInPaymentMethodId` | P3 |
| 0.2 | Reserve cap in `depositToSavings` and `correctSavingsBalance` for a reserved pocket (returns false over the cap). A declared deposit with **no account leg** into a reserved pocket is refused; a declare that names an account (Accounts > Set aside, `actions.ts:68-70`) and the opening deposit at creation keep working. | `useFinanceStore.ts:1798-1851`, `:2015-2047`; `AddSavingsSheetV3.tsx`; `EditSavingsAccountSheet.tsx`; `buddgy/tools/exec/savings.ts`; `ai/aiActionHandlers.ts` | ML-1, ML-2, R6, R10 |
| 0.3 | Budget deposit with no valid leg: refused with a message unless the user picks "New money". | `useFinanceStore.ts:1817-1819`; `AddSavingsSheetV3.tsx`; `GoalAddMoneySheet.tsx` | DC-5, R16 |
| 0.4 | Pocket form: currency locked to the account's when created from an account. Remove the dead "Also a payment method" toggle. | `PocketFormSheet.tsx:64`, `:182`, `:194-196` | DC-3, P10 |
| 0.5 | Available now = sum of per-account free. | `AccountsHero.tsx:26`; `useAccounts.ts` (add `freeInBase`) | P7, R3 |
| 0.6 | Signed gap: a positive gap gets its own title and answers (income not logged, transfer in, a pocket deposit that never left the bank, correct the balance); negative keeps today's. | `AccountRow.tsx:31-35`; `FixGapSheet.tsx:45`, `:76-96`; en and ar copy | P11, R24 |
| 0.7 | Goal "Already saved" and Buddgy `add_goal`: ask the home; in a tracked account creates the goal pocket held there, capped. | `useNewGoalForm.ts:209-221`; `StepMakeItReal.tsx`; `buddgy/tools/exec/goals.ts:166-187`; specs | DC-1, R17 |

Backfill: none. Tests (unit, through the real store actions, in the style of `src/lib/accounts/__tests__/pocketExitsNetWorth.test.ts`): R5, R6, R8, R9, R10, R16 as round trips asserting `accountsBasisFor` + `computeNetWorth`; hero equals sum of rows; positive-gap answers move the ledger toward the bank.

### Phase 1: make the home explicit and repair existing rows (migration)

Migration A (next free number), all additive and safe to run again:
- `savings_accounts_home_guard` trigger, never raising (the sync batch must not wedge, as `payment_methods_guard` in `0150`): on insert or update, if `held_in_payment_method_id` names a row of another user, a non-holding type, or another currency, set it to NULL.
- Extend `payment_methods_guard` so a soft delete of an account that still has live pockets held in it becomes a close.
- No new column: home is `held_in` set or not, and the outside kind is the existing `type` (plus `metadata` for certificate fields).
- `get_advisors` after applying; the index `idx_savings_accounts_held_in` already exists (`0151:18`).

Engine:
- `accountsBasisFor` and `useAccounts` share one "counted account" predicate (tracked, not excluded, not closed) so net worth, zakat and the Accounts list agree (`netWorthBasis.ts:11`, `zakatAccounts.ts:10`, `useAccounts.ts:59`).
- `convertPocketHome(pocketId, accountId | null)`: the only way to change a home, implementing the four-part contract of R14 (leg-less rows: net worth falls by the double count; rows that debited the new holder: its balance is restored, no adjustment; everything else: freeze adjustments with `reason: 'opening_correction'`; then a confirm-balance step). With undo.
- Closing an account with reserved pockets opens a two-choice sheet (release all, or move to another account) before `closeAccount` (`actions.ts:86-91`, `AccountDetailSheet.tsx:76-82`).

Backfill, with row counts (2026-11-24):

| Rows | Count | Action |
|---|---|---|
| Pockets linked to a tracked account but not held (other currency) | 1 | Not automatic. Shown to that user as the ask-once prompt below. |
| Pockets linked to a method that is not a tracked balance account (untracked, a card or deleted: not broken down) | 2 | Nothing now; R21 asks when the account gets a balance. |
| Standalone pockets with money, owner also tracks accounts | 12 pockets, 6 users (6 of type bank) | Ask once per pocket, in the app: "Is this money inside one of your accounts?" Yes runs `convertPocketHome` (R14) on the device; No or later leaves it. No server rewrite. Of the 33 live pocket rows, 5 carry an account leg, so case (ii) is rare but real. |
| Held pockets | 2 (1 with money) | Unchanged. |
| Goals with a manual amount | 0 | None. `manualCurrentAmount` stays readable for debt goals. |
| Savings rows with `goal_opening` | 0 | None. |
| Holdings, investment-category pockets | 0 and 0 | None. |

Tests: guard trigger cases (SQL, on a branch database or the QA runner); `convertPocketHome` in three seeded cases, each through the real store actions: (a) pocket opened with declared money: account balances unchanged, net worth falls by the pocket amount; (b) pocket funded by a budget deposit from the new holder: holder balance rises by the deposit, net worth unchanged, no adjustment written; (c) pocket with an old spend and a leg against another account: no account balance changes, freeze adjustments written and removed by undo; close-account flow; sync round trip of a converted pocket (old build pulls a pocket whose `held_in` changed).

### Phase 2: the simplified screens

- Pocket creation in three steps (7.3): rework `AddHoldingSheet` pocket tab and `PocketFormSheet` around the home list; untracked account asks its balance through the existing set-balance step.
- Add and take-out sheets (7.5): `AddSavingsSheetV3` drops the budget segmented control for reserved pockets and shows "From my account / New money" for outside pockets; `WithdrawSheetV3` gets the three first-level choices, keeping its existing sub-forms.
- Labels and identity (7.2): Wealth hero big number becomes `Hold = A + O + I` shown as three cells (Available, In pockets, Investments); Accounts hero keeps "Available now"; "Set aside" cell shows covered reserved; one info line per label. Copy in `en.ts` and `ar.ts` (`wealthPage`, `accountsPage`, `wealthSheets.money`).
- Home sub-line and shortfall line on pocket rows (`WealthList`, pocket detail).
- R21 prompt on first balance of an account; ask-once prompt for the 12 existing pockets (pattern of the cash-on-hand ask, `dismissBanner`).

Migration: none. Backfill: none. Tests: targeted journey in `e2e/journeys/specs/d-pockets.spec.ts` (create reserved pocket, create outside pocket, release at zero available, over-reserve by spending, goal with already-saved in an account), listed in `e2e/README.md`; unit tests for the four-part identity on random states (R4).

### Phase 3: goals, crons and release semantics

- Server: when a primary account is tracked, carry and goal funding create and use pockets reserved in it and clamp to available (R18). A user whose default carry pocket is outside and who tracks an account is offered the R21 conversion; until they answer, the cron keeps today's transfer (account down, pocket up: net worth unchanged, DR-1 drift remains and is listed as known). The account leg is never dropped from such a row: a deposit with no leg would raise net worth from nothing (DC-5). With no tracked account nothing changes.
- Release without an income event for reserved pockets (decision D4): a withdrawal row with a `source: 'release'` marker read by `computeBalances` as rule 7; left-to-spend reads it as returned savings. Old rows with the paired income event keep working.
- One active goal per pocket (R17): the link sheets refuse a pocket that another active goal already uses; existing shared links are shown, not rewritten.
- Holding purchase source (R22) in `AssetFormSheet`.

Migration B (next free): only if D4 needs `savings_transactions.source` values documented or a partial index; expected none. Backfill: none (0 holdings; carry rows already written keep their legs). Tests: cron unit tests with a tracked primary account and a standalone default pocket; release round trip leaves income totals unchanged; `allocateGoalFunding` clamp.

### Phase 4: optional, after council

Pockets with money in several homes (D1), investment holdings grouped under a pocket through `savings_holdings.account_id`, frozen FX legs for cross-currency moves (R15), receivables as assets (D7).

---

## 10. Potential Regression Risks

1. **Old native builds.** Balance rules are read-side, so an old build computes the old number from the same rows until it updates. Phase 0 guards live in the store, which old builds do not have: they can still write a declared deposit into a reserved pocket. The Phase 1 server guard cannot catch that (it is a ledger row, not a home change). Ship with a native build and accept the window.
2. **Holder immutability.** Any path that sets `held_in` on an existing pocket re-derives every past leg (`types.ts:665-669`). Only `convertPocketHome` may do it, always with a freeze. A direct SQL backfill would silently move account balances.
3. **Sync.** The server keeps the newest edit; a converted pocket must carry a fresh `updatedAt`, and its freeze adjustments must reach the server in the same flush or another device shows a wrong balance for a moment. The savings-balance delta switch (`0227`) changes who owns `current_balance`; its live state is not verified.
4. **Net worth trend.** Changing what the hero's big number means and removing double counts produces a step in `net_worth_snapshots`. Use a new `basis` value so the trend does not draw the correction as a loss.
5. **Zakat and emergency fund.** Zakat reads the same held set (`zakatAccounts.ts:14-16`); the emergency cover sums every savings pocket (`wealth/page.tsx:128-133`), reserved or not. Converting a pocket must not change cover; an over-reserved pocket overstates it (decision D12).
6. **Left-to-spend.** Removing the budget question changes which deposits count against the month. Pin with tests on `cashSavingsDepositsInBaseForMonth` (`calculations.ts:515`) and `monthlyStats.ts:278`.
7. **Crons.** Clamping carry and goal funding to available can leave a remainder; `savings_month_summary` and `goal_allocation_runs` must record what was actually reserved, or streaks and "behind" flags drift.
8. **Buddgy and the AI handler.** They call the same store actions (`buddgy/tools/exec/savings.ts:270`, `:326`, `:387`; `ai/aiActionHandlers.ts:845`). New refusals need tool-level messages, or the assistant reports success for a move that was refused.
9. **Budget Studio.** It already implements the location question (`studioEntities.ts:93-108`); the shared helper must keep its tests green (`pocketEarmarkNetWorth.test.ts:76-134`).
10. **Gap sheet.** Changing the meaning of a positive gap touches the Accounts journeys and the snooze logic (`useAccountGaps.ts:18-20`).
11. **Account close guard.** Refusing a close with reserved pockets changes an existing flow; the server trigger must mirror it or a device and the server disagree.
12. **Copy.** New Arabic labels must follow the Arabic number and direction rules in `docs/DESIGN_SYSTEM.md`; long labels on `HeroBand` cells need `fitCells`.

---

## Decisions for council

| # | Question | Recommendation | Alternatives |
|---|---|---|---|
| D1 | One home per pocket, or a pocket made of parts in several homes (30,000 in CIB plus 20,000 cash)? | One home per pocket now. A purpose spread over two places is two pockets under one goal (goals already link several pockets). Simplest rules, no new table, matches the column that exists. | Parts table (`pocket_parts`) in Phase 4; or a per-row home derived from the ledger (flexible, but every withdrawal must then choose a part). |
| D2 | When an account falls below what is reserved in it | Flag and guide (R7): nothing changes silently. | Auto-shrink pockets (by priority or pro rata); or block the spending entry (impossible for SMS). |
| D3 | Does the user still choose whether a deposit counts against this month? | Derive it (R23). One question on the sheet, the location one. | Keep both questions; or keep the budget choice under "More options". |
| D4 | Is a release an income event? | No for reserved pockets: a release row with no income event. | Keep the income event (today); or keep it but hide it from income totals. |
| D5 | Existing standalone pockets that may be inside tracked accounts (12 pockets, 6 users) | Ask once per pocket in the app; unanswered stays as is. | Heuristic auto-convert of type `bank` pockets; or leave untouched and fix only new data. |
| D6 | Closing an account with reserved pockets | Refuse until released or moved (R20). | Auto-release on close; or convert them to outside pockets. |
| D7 | Money owed to the user | Keep out of net worth for now; show it as its own line under "What you hold" later. | Count receivables as assets now. |
| D8 | "What you hold" definition | Gross assets `A + O + I`, so net worth = hold minus owe. | Keep "savings and investments only" and rename it "Savings and investments". |
| D9 | Deleting an outside pocket that has money | Ask where the money went (R19). | Always remove it from net worth; or always return it to the account that funded it (today, by accident). |
| D10 | New holding: ask what paid for it? | Yes (R22), two choices. | Leave as is until a user holds investments (0 live). |
| D11 | Excluding an account that has reserved pockets | The pockets leave the totals with the account: they are part of its balance. Zakat follows the same rule. | Keep today's behaviour (pocket counted on its own, `netWorthBasis.ts:22`, tested); or refuse to exclude while pockets are reserved in it. |
| D12 | Emergency cover when a pocket is not fully covered by its account | Cover counts the covered part only (`min` of pocket and what the account can back). | Keep counting the full pocket amount (`wealth/page.tsx:128-133`). |

---

## Edge-Case Matrix

"Current" is committed code in this worktree. Amounts in EGP unless stated. H = CIB, tracked, 100,000 at the start of each row.

| # | Scenario | Expected by the rules | Current behaviour | Gap |
|---|---|---|---|---|
| 1 | Create pocket from H, 30,000 | NW 100,000; available 70,000; pocket 30,000 (R5) | Same (`PocketFormSheet.tsx:78-97`) | None |
| 2 | Create pocket from H, 130,000 | Refused (R6) | Refused (`:80`) | None |
| 3 | Create "Bank account" pocket from the kinds grid, 30,000, money is in H | Asked for the home; reserved; NW 100,000 | NW 130,000 | DC-2 |
| 4 | Create "Cash at home" pocket, 20,000, not tracked anywhere | NW 120,000 once (R9) | NW 120,000 | None |
| 5 | Pocket from H, user switches currency to USD | Currency locked (R15) | Standalone, NW rises | DC-3 |
| 6 | Pocket from untracked NBE 30,000; later NBE set to 100,000 | Asked once; reserved; NW +100,000 only (R21) | NW +130,000 in total | DC-4 |
| 7 | Add 20,000 "outside the budget" into a pocket held in H | Refused; record on the account first (R10) | Pocket +20,000, NW unchanged, reserved may exceed balance | ML-1 |
| 8 | Add 500 USD from "this month's budget" to a USD outside pocket, only EGP accounts | Sheet says no account can fund it; New money or cancel (R16) | Pocket +500 USD, no account debited | DC-5 |
| 9 | Set aside 10,000 from H into a pocket held in H | Available -10,000, NW unchanged | Same (`balance.ts:128`) | None |
| 10 | Set aside 10,000 from H into an outside pocket | H -10,000, O +10,000, NW unchanged (R11) | Same (`balance.ts:126-133`) | None |
| 11 | Release 30,000 from a pocket held in H when H's available is 0 | Allowed; available +30,000; NW unchanged (R8) | Allowed (`WithdrawSheetV3.tsx:112`), written as an income event | Works; income side effect (D4) |
| 12 | H drops to 15,000 by SMS spending, 30,000 reserved | Shortfall 15,000 shown; available 0; NW counts 15,000 (R7) | Available 0, pocket shows 30,000, no notice | ML-3 |
| 13 | A 20,000 with 30,000 reserved; B 50,000 | Available 50,000 (R3) | Hero 40,000, rows 0 and 50,000 | P7 |
| 14 | Spend 600 from a pocket held in H | H -600, NW -600 (R12) | Same (`balance.ts:147`) | None |
| 15 | Pay 600 of card debt from a pocket held in H | H -600, debt -600, NW unchanged | Same | None |
| 16 | Invest 600 from a pocket held in H | H -600, holding +600, NW unchanged | Same | None |
| 17 | Move 600 from a pocket in H to an outside pocket | H -600, O +600, NW unchanged (R13) | Same (`balance.ts:136-140`) | None |
| 18 | Move 600 between two pockets both held in H | Nothing moves | Same (`balance.ts:138`) | None |
| 19 | Release 5,000 from an outside pocket, no tracked account in that currency | Asks where it is now; "Cash in hand" removes it from O | Pocket -5,000, income event with no account, NW -5,000 without asking | DR-3 |
| 20 | New goal Car, already saved 30,000, money in H | Asked; reserved in H; NW 100,000 (R17) | Standalone vault 30,000; NW 130,000 | DC-1 |
| 21 | New goal, already saved 30,000 in cash at home | NW 130,000 once | NW 130,000 | None |
| 22 | Goal add-money 5,000 from H into the goal's client-made vault | Reserved in H; H unchanged | H -5,000, vault +5,000; ledger below the bank | DR-1 |
| 23 | Month-end carry 5,000, default pocket standalone | Reserved in the primary account (R18) | Primary -5,000, pocket +5,000; ledger below the bank | DR-1 |
| 24 | Month-end carry 5,000, vault held in the primary account | Label only | Label only (`balance.ts:128`) | None |
| 25 | After row 23, user updates H to the bank's figure | No change needed | +5,000 adjustment; NW +5,000 | DC via DR-1 |
| 26 | After row 23, two bank reports show 5,000 more than the ledger | "The bank shows 5,000 more" with matching answers (R24) | "5,000 missing"; "I spent it" subtracts 5,000 more | P11 |
| 27 | One pocket linked to two active goals | Refused at link time (R17) | Both goals count it fully | DC-8 |
| 28 | Delete a pocket held in H after spending from it | H keeps its balance (freeze) | Same (`useFinanceStore.ts:1759-1769`) | None |
| 29 | Delete an outside pocket funded 10,000 from H | Asked where the money went (R19) | H +10,000 silently | DR-2 |
| 30 | Close H while 30,000 is reserved in it | Refused until released or moved (R20) | Closed; hidden from Accounts, still in NW (committed); pockets reappear as their own money (sibling worktree) | ML-4 |
| 31 | Exclude H from totals | H and its reserved pockets leave every total (R20) | H leaves; the 30,000 pocket is counted on its own | ML-5, decision D11 |
| 32 | Cash pocket 20,000, then user answers the cash-on-hand ask with 25,000 that includes it | Asked once whether the pocket is inside Cash (R21) | Cash counted as 45,000; true 25,000 | DC-6 |
| 33 | Add gold holding 60,000 bought from H, no expense recorded | "Bought now from H": H -60,000, NW unchanged (R22) | Holding +60,000, H unchanged | DC-7 |
| 34 | Card payoff SMS 5,000 with no account matched | Pending item; NW not improved until placed | Debt -5,000, no account debited | DR-5 |
| 35 | Salary logged by hand with no account, accounts tracked | Account is required, or the entry is flagged as not in any balance | Ignored by balances and NW | ML by omission |
| 36 | Expected (not received) salary | Not in NW | Not in NW (`balance.ts:39`) | None |
| 37 | SMS credit on a provisional account, later confirmed with a balance | Counted once, through the opening balance | Same (`kinds.ts:33`, `balance.ts:69`) | None |
| 38 | Gold pocket, no gold price | Left out; totals marked "at least" | Same (`savingsConversions.ts:23-25`, `netWorth.ts:64-67`) | None |
| 39 | USD account with no FX rate | Left out and flagged | Same (`netWorthBasis.ts:16-19`) | None |
| 40 | Edit a held pocket's amount to more than the account holds | Refused (R6) | Accepted | ML-2 |
| 41 | No tracked account, no pockets, 10,000 card debt | NW -10,000 (R1) | Committed: income minus outflow minus debt. Sibling worktree: -10,000 | DC-9 until the change lands |
| 42 | Lend 5,000 from H to a friend | NW -5,000 until repaid, or receivable shown (D7) | NW -5,000 | Decision |
