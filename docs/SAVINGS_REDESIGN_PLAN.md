# Savings Tab — Audit, Enhancements, and Redesign Plan

> Status: **proposal for review. Nothing implemented.**
> Author: audit pass 2026-07-24. Scope: `/savings`, its store slice, DB tables, and every
> connection into income, budget, goals, net worth, reports, and sync.

---

# PART 1 — What exists today

## 1.1 Surfaces

| Thing | Where |
|---|---|
| Page | [src/app/savings/page.tsx](src/app/savings/page.tsx) — 349 lines, one flat screen |
| Nav | `/savings` in bottom nav (gold `Coins`); `/goals` maps to the **same** nav slot |
| Cards | `SavingsAccountCard`, `SavingsCardConversionLine`, `SavingsAccountIcon` |
| Sheets | `AddToSavingsSheet` (deposit **+** create-account tab **+** optional monthly recurring), `WithdrawFromSavingsSheet`, `UpdateBalanceSheet` (correction), `AddSavingsAccountSheet`, `EditSavingsAccountSheet`, `SavingsProductTypePicker` |
| Ledger | `SavingsTransactionHistory` (flat, unfiltered) |
| Elsewhere | `DashboardSavingsCard`, `ReportsSavingsPanel`, `savings_nudge` notification, `ProfileGoalsSummary` |

Page anatomy today: header strip (net worth / total saved / total-in-base) → a
"breakdown" card (net worth, savings, investments, this-month flow, debt) → flat list
of account cards → full ledger. No sub-tabs, no grouping, no filtering, no charts.

## 1.2 Domain model (`src/lib/store/types.ts`)

```
SavingsAccount   id, name, category('savings'|'investment'), type, icon, currency,
                 currentBalance, notes, targetAmount(DEAD), emoji(legacy)
SavingsType      bank | cash | gold | stablecoin | crypto | stocks | real_estate | other
SavingsTransaction  accountId, type('deposit'|'withdrawal'), amount, currency, date,
                    source?, notes?, isAutoSave?, isCashFlow
RecurringSavingsDeposit  accountId, amount, currency, monthly, dayOfMonth(1–28), nextDueDate
SavingsHolding   LEGACY — bucket/subtype/amount. No create or edit UI anywhere.
```

The savings-vs-investment split **already exists in the model**
([savingsTypes.ts](src/lib/constants/savingsTypes.ts)):

- `SAVINGS_PRODUCT_TYPES` = bank, cash, gold, stablecoin
- `INVESTMENT_PRODUCT_TYPES` = crypto, stocks, real_estate, other
- `defaultCategoryForSavingsType()` derives `category` from `type`.

It is simply **not surfaced in the UI**.

## 1.3 Store actions (`useFinanceStore.ts` ≈ L1200–1450)

| Action | Effect |
|---|---|
| `addSavingsAccount({ openingBalance })` | Creates account **and** an `"Opening balance"` deposit tx with `isCashFlow:false` |
| `depositToSavings(id, amt, cur, notes, opts)` | Ledger row + `currentBalance +=`, FX-converts into the account's currency, then `reconcileGoalsForState` |
| `withdrawFromSavings(...)` | Ledger row + `currentBalance -=` **and creates an `IncomeEvent`** (`sourceType: 'investment'\|'savings'`, `linkedSavingsAccountId`, status `confirmed`, clears `noIncomeDeclared`) |
| `correctSavingsBalance(id, newBalance)` | Signed ledger row with `isCashFlow:false` — a revaluation, not cash |
| `deleteSavingsAccount(id)` | Cascades txs + recurring, unlinks from goals, reconciles goals |
| income-event delete (L392) | Reverses a savings withdrawal — puts the money back with `isCashFlow:false` |

`useRecurringSavingsScheduler` is a client `setInterval(60s)` in a React hook.

## 1.4 Money math — this part is genuinely well built

`useNetWorth` = `totalSavings + totalInvestments + monthlyFlow − totalDebt`, split by
`account.category`. `monthlyFlow = totalIncome − cashOutflow`, and cash savings deposits
are inside `cashOutflow`, so **a deposit is net-worth neutral** — the money moves from
flow to balance sheet. Opening balances and corrections are excluded from that netting
via `isCashFlow = false`, which is exactly right (see migration `0085` — the reasoning in
that file is correct and worth preserving through any redesign).

## 1.5 Database (verified live)

| Table | Notes |
|---|---|
| `savings_accounts` | category, type (enum incl. `stock`/`bond`), icon, currency, `opening_balance`, `current_balance`, notes, soft-delete. **No** target_amount, institution, APY |
| `savings_transactions` | kind, amount, currency, `balance_after` (**always written null**), transaction_date, notes, `is_cash_flow`. **No** `source`, **no** `is_auto_save`, **no** goal/transfer link |
| `savings_holdings` | `account_id, asset_symbol, asset_name, asset_type, quantity, initial_amount, current_value, purchase_date` — **fully specced for market-tracked positions and completely unused by the app.** This is the exact table requirement #3 needs |
| `recurring_savings_deposits` | fine |
| `income_events.linked_savings_account_id` | the savings↔income seam |
| `goals.linked_savings_account_ids uuid[]` | the savings↔goals seam |

Sync: `useHydrateSavings` (blind slice replace, guarded by warm-cache check) + snapshot /
merge / push in `src/lib/supabase/remote/`.

## 1.6 Defects found during the audit

1. **Crypto balances are counted 1:1 into net worth.**
   `savingsAccountBalanceInBase()` calls `convertCurrency()` — which **fails open**, logging
   an error and returning the original amount when no rate path exists. `/api/rates` serves
   fiat + XAU only; there is no BTC/ETH rate. So **0.5 BTC becomes 0.5 AED** in net worth,
   in `totalInvestments`, and in the savings nudge. The card politely says "Live price
   coming soon" while the headline number is silently wrong. This is a real money bug and
   should be fixed before anything else, independently of this plan.
2. `savingsTransactionToRow` **drops `source` and `isAutoSave`** — no DB columns exist. Any
   reload from the server loses the provenance of every recurring/auto deposit.
3. `balance_after` is always written `null`; the column is dead weight or an unfinished audit trail.
4. **Three parallel "savings" concepts**: the account ledger, the legacy `savingsHoldings`
   array, and expenses with `category === 'Savings'`. `useMonthlyStats.savingsTotal` sums
   **all three**. A user who both logs a "Savings" expense and deposits to an account is
   double-counted.
5. `SavingsAccount.targetAmount` is dead. Goals link by whole-account ID, so a goal linked
   to an account you also use for other things over-reports progress (the entire balance counts).
6. **Recurring deposits only fire while the app is open and foregrounded.** Miss a month
   and the catch-up posts on next open with *today's* date, not the due date.
7. **Every withdrawal becomes income** — even when the money is going to buy another asset
   or pay a debt. That inflates the income KPI and the budget's "left to spend".
8. There is **no transfer between savings accounts**. Doing it manually (withdraw + deposit)
   mints a phantom income event.
9. Gold is hard-coded 24k everywhere (`goldGramsToMoney(..., 24)`). No 21k/18k handling —
   which is the *default* way gold is held in Egypt and the Gulf.
10. `savingsThisMonth` (projected while the month is open, realized once closed) is computed
    and displayed but **never posted anywhere**. That is precisely the write-side that
    requirement #5 asks for.

---

# PART 2 — Enhancements I'd propose independently of your list

Ranked by (value ÷ effort). Everything here is *my* read before looking at your
requirements; Part 3 reconciles the two.

### Tier A — correctness, do regardless

- **A1. Fail-closed valuation.** Any asset with no price path must render as "value
  unavailable" and be **excluded** from net worth, exactly like the existing
  `goldPriceAvailable` guard already does for gold. Fixes defect #1 permanently, not just
  for crypto.
- **A2. Collapse the three savings concepts to one.** The account ledger is the source of
  truth. Retire `savingsHoldings` (or repurpose the table for market positions — see D1) and
  stop counting `Savings`-category expenses in `savingsTotal`; convert that category into a
  transfer that posts a real deposit.
- **A3. Persist `source` / `is_auto_save`**, and either populate `balance_after` at write
  time or drop the column.

### Tier B — the highest-value missing product features

- **B1. Emergency-fund tracker.** Months-of-expenses covered by liquid savings. You already
  have every input (avg monthly spend from `useMonthlyStats`, liquid balances by category).
  Single most useful number a budgeting app can show, and it costs almost nothing.
- **B2. Savings rate.** `net savings ÷ income`, this month + 3/6/12-month trend. Again, all
  inputs exist.
- **B3. Transfer between accounts** (one action, two ledger rows sharing a `transfer_group_id`,
  no income event). Closes defect #8.
- **B4. Withdrawal purpose.** `to income` (today's behaviour, default) / `to another account`
  / `to a debt payment` / `spend`. Closes defect #7 and makes savings→debt possible.
- **B5. Allocation view.** Donut by category and by type, with concentration flagged
  ("78% of your net worth is one asset").

### Tier C — quality of life

- **C1. Filterable ledger** (account, type, date range) + monthly grouping + running balance.
- **C2. Contribution streak / consistency** — "8 months in a row".
- **C3. Per-account APY** for bank savings → simple projected interest. Arithmetic, no feed.
- **C4. "As of" freshness stamps** on every price-derived number, everywhere.
- **C5. Reminder to re-value** manually-valued assets (real estate, unlisted) every N months.
- **C6. Zakat estimator** — 2.5% on qualifying assets held a lunar year. For an EG/AE/SA
  audience this is genuinely differentiating and you already hold gold grams and cash
  balances. Opt-in, clearly labelled as an estimate.

### Tier D — the expensive stuff

- **D1. Market-tracked holdings.** Reuse `savings_holdings` as designed: an account holds N
  positions (`asset_symbol`, `quantity`, `unit_cost`), and value = quantity × live price.
  This is what unlocks P&L, and it is the correct model — not a hand-typed `currentBalance`.
- **D2. Cost basis and P&L** (unrealized, realized on withdrawal). Needs D1.
- **D3. Historical net-worth chart** — needs monthly snapshots to be persisted; nothing
  stores them today.

### Explicitly NOT recommended

Price *projections*, buy/sell suggestions, "advice", tax-lot accounting, order execution,
and anything that reads as a recommendation. It converts a budgeting app into a regulated
surface in exactly the markets you're targeting, for near-zero user benefit.

---

# PART 3 — Your requirements, reviewed

### Req 1 — Track savings that pre-date the app ✅ already shipped

`addSavingsAccount({ openingBalance })` already writes an `"Opening balance"` ledger row
with `isCashFlow:false`, so declaring an existing 50k does **not** pollute this month's
flow. The math is right.

**What's actually missing** is discovery, not logic: opening balance is buried inside the
create-account form, there's no "let's capture what you already have" moment, and no
onboarding step for it. Small work, do it in Phase 1.

### Req 2 — Two sub-tabs like Debt ✅ agree, and the model is already there

Data model done, UI missing. Cheap and high-value.

**One pushback on your definition.** "Savings = no profit, Investment = grows" breaks
immediately: a bank savings account paying 4% is still *savings* in every user's head, and
gold *floats with a market* but is treated as savings by most of your target audience.

Better axis, same two tabs:

> **Savings** = principal you expect back at face value (capital-preserving).
> **Investment** = value floats with a market.

Gold technically belongs in Investment under that rule — but Egyptian and Gulf users
overwhelmingly think of gold as savings. **Resolution: the user picks the tab per account**,
defaulted by type via the existing `defaultCategoryForSavingsType()`. Keep that function as
a *default*, never a constraint. Interest/APY becomes an attribute of an account, not a
tab-determining property.

### Req 3 — Crypto / stocks / gold with live prices — the big one

**Structure: one Investment tab, sectioned by asset class, with a drill-down detail page per
asset class or holding.** Not four top-level tabs.

Why: the bottom nav has five fixed slots; most users hold zero or one of these; four
mostly-empty tabs is worse UX than one populated tab; and every cross-asset number you
actually want (allocation, total P&L, net worth) needs them on one screen anyway. Gold earns
a rich drill-down — because gold is the one asset where the extra local data both exists and
matters in your markets.

**Now the honest feasibility answer, per asset class:**

| Asset | Live data? | Verdict |
|---|---|---|
| **Crypto** | Yes, free, easy. CoinGecko free tier (no key, ~10k calls/month, 30/min) | **Ship it.** Server-cached in a route mirroring the existing `/api/gold` pattern. One call covers every coin |
| **Gold — global spot** | Already shipped: `/api/gold`, four providers with fallback | **Already have it** |
| **Gold — 21k / 18k** | Pure arithmetic: spot × 0.875 / × 0.750 | **Free.** No API. Just stop hard-coding 24k |
| **Gold — local retail (EG/SA/AE)** | **Not derivable from spot.** Local = spot + workmanship + dealer premium + FX distortion (Egypt's parallel rate especially). No reliable free API | **Don't fake it.** Spot-derived value is the source of truth; add an optional user-set "local premium %" per country and show the local-vs-global gap *only* when a real local number exists |
| **Stocks — US / global** | Free tiers exist (marketstack, Finnhub, Alpha Vantage) but are rate-limited and mostly **delayed or EOD** | **Ship end-of-day**, stamped "as of <date>" |
| **Stocks — Tadawul / DFM / ADX / EGX** | Real-time is **licensed and expensive**. Free coverage is index-level or EOD and unreliable | **EOD only**, or paid (EODHD covers EGX/Tadawul on paid plans). Do not promise real-time |
| **Real estate** | No feed exists, anywhere | Manual valuation + a periodic re-value reminder |

So: *"accurate and always up to date"* is achievable for **crypto and gold**, and honestly
achievable as **end-of-day** for stocks. Anyone promising you free real-time Gulf equities is
selling something. Design the UI around an **"as of" timestamp on every number** and this
stops being a limitation and becomes a trust signal.

On projections and advice: **drop them.** Show price, holdings, P&L, allocation, history.
Do not show forecasts or suggestions. It is the difference between a finance tracker and a
regulated product, in exactly the jurisdictions you're targeting.

### Req 4 — Withdraw to income / add to savings 🟡 half shipped

`withdrawFromSavings` **already** creates an `IncomeEvent` (`sourceType: savings|investment`,
`linkedSavingsAccountId`, confirmed), and deleting that income event correctly reverses the
withdrawal. That half is done and works.

What's missing:

- The reverse direction has no *narrative*. A deposit is netted into `cashOutflow`, so net
  worth is right, but nothing on the income/budget side says "this month's money went here",
  and you can't fund a deposit from a specific income event or payment method.
- **Withdrawal always becomes income**, which is wrong when the money is buying an asset or
  paying a debt (defect #7). This needs the **purpose selector** from B4.

### Req 5 — Month-end leftover → savings 🟡 genuinely missing, and needs care

`savingsThisMonth` is already computed (projected while open, realized once closed) but never
posted. Two traps:

1. **Don't auto-post.** A user who already deposits manually would be double-counted. Make it
   a **proposal**: on first open after the cycle closes, a card — *"Last month you had 1,240
   left over. Move it to savings?"* → pick account / dismiss / "always do this".
2. **Date it to the last day of the closed month, with `isCashFlow: true`.** If you post it
   into the new month, the new month shows an outflow that never happened. Dating it into the
   closed month drops that month's flow by X and raises the balance by X — net worth unchanged,
   and the leftover stops floating in `monthlyFlow` forever.

Also needs a persisted month key so it runs exactly once per cycle (idempotent by
`user_id + month`).

### Req 6 — Net worth, by-category, goals summary 🟡 partly there

The breakdown card already shows net worth / savings / investments / flow / debt. Missing:
by-**type** breakdown, allocation visual, a goals-progress summary on the savings tab, and
goal linkage visible from the account card.

**Caveat**: you're redesigning goals next. Build the savings tab against a thin
`useGoalsSummary()` seam so the goals rewrite doesn't force a savings rewrite.

### Req 7 — "Anything else?"

Take from Part 2: **B1 emergency fund** (highest value per line of code in this whole
document), **B2 savings rate**, **B3 transfers**, **C1 filterable ledger**, **C4 freshness
stamps**, **C6 zakat** (optional, market-differentiating). Skip D3 historical net-worth chart
for now — it needs a snapshot table and pays off only after months of data.

---

# PART 4 — The plan

Each phase is independently shippable and independently useful. Stop after any phase.

### Phase 0 — Correctness (ship first, ~small)

- Fail-closed valuation for any asset without a price path (fixes the crypto 1:1 bug for
  crypto *and* every future asset). `savingsAccountBalanceInBase` returns `null`; every
  caller renders "unavailable" and excludes it, mirroring the existing gold guard.
- Migration: `savings_transactions` += `source text`, `is_auto_save bool default false`.
  Update the mapper. Populate `balance_after` at write time or drop the column.
- Decide the fate of `savingsHoldings` (retire, or hold it for Phase 5 — it is the right
  table for market positions).
- Stop double-counting `Savings`-category expenses in `savingsTotal`.

### Phase 1 — Structure (Req 2, Req 1 polish)

- Savings / Investment sub-tabs, mirroring the Debt tab pattern.
- Per-tab totals; category is user-editable per account, defaulted by type.
- Surface opening balance as a first-class "I already have savings" entry point.
- No DB change.

### Phase 2 — Money movement (Req 4, B3, B4)

- Transfer between accounts — migration: `savings_transactions.transfer_group_id uuid`.
- Withdrawal purpose selector: income (default) / transfer / debt payment / spend.
- Deposit funding source (optional link to income event or payment method).

### Phase 3 — Month rollover (Req 5)

- New table `month_rollovers (user_id, month_key, amount, currency, account_id, status)`,
  unique on `(user_id, month_key)`.
- Proposal card on first open after cycle close; posts a normal deposit dated to the last
  day of the closed month.

### Phase 4 — Insights (Req 6, B1, B2, B5)

- Emergency-fund months-of-expenses.
- Savings rate + trend.
- Allocation donut by category and by type.
- Goals summary via a `useGoalsSummary()` seam. **Sequence after the goals redesign.**

### Phase 5 — Live markets (Req 3) — the big one, do it last

- Migration: new `asset_prices (symbol, asset_class, price, currency, as_of, source)` —
  a shared server-side cache, service-role writes, readable by all users, **not** user-scoped.
- `savings_holdings` gains `unit_cost`, `cost_basis_currency`; becomes the position model
  (account → N holdings; value = Σ quantity × live price).
- `/api/prices` route following the `/api/gold` multi-provider fallback pattern.
  Crypto first (CoinGecko, free). Stocks EOD second. Gold karats are arithmetic on the
  price you already fetch.
- Investment tab sections per asset class + a gold detail screen (24k/21k/18k, holdings by
  karat, optional local-premium override, local-vs-global gap when a real local number exists).
- "As of <time>" on every price-derived number, everywhere.
- No projections. No advice.

### Phase 6 — Optional

Zakat estimator, APY projection, re-value reminders, contribution streak, filterable ledger.

### Phase 7 — UI/UX redesign

After you pick which of the above survives, audit the current UI/UX and produce a redesign
brief in the same spirit as expenses / income / debt / payment methods. Deliberately left
open — no visual criteria prescribed here.

---

## Migrations this plan implies (in order)

| Phase | Migration |
|---|---|
| 0 | `savings_transactions` += `source`, `is_auto_save`; decide `balance_after` |
| 2 | `savings_transactions` += `transfer_group_id` |
| 3 | new `month_rollovers` |
| 5 | new `asset_prices`; `savings_holdings` += `unit_cost`, `cost_basis_currency` |

Optional, if adopted: `savings_accounts` += `target_amount`, `institution`, `apy`,
`is_emergency_fund`.

---

## Open questions for you

1. **Gold's home tab** — Savings (user intuition in EG/AE) or Investment (technically correct)?
   My recommendation: default to Savings, let the user move it.
2. **Stocks** — accept end-of-day pricing, or budget for a paid real-time feed?
3. **Zakat** — in or out?
4. **Rollover** — proposal card (my recommendation) or fully automatic with a settings toggle?
5. **`savingsHoldings`** — retire it, or hold it for Phase 5 as the position model?

## Sources for the market-data feasibility call

- [CoinGecko free crypto API tiers](https://www.coingecko.com/learn/best-free-crypto-api)
- [Best free crypto API 2026 — tier comparison](https://coinmarketcap.com/academy/article/best-free-crypto-api-in-2026-free-tier-comparison)
- [Marketstack — free stock market data API](https://marketstack.com/)
- [EODHD — EGX exchange coverage](https://eodhd.com/exchange/EGX)
- [GCC index data — Tadawul / ADX / DFM / QE](https://masadir.net/datasets/gcc-indices)
- [Saudi stock market API (Tadawul, WebSocket/OHLCV)](https://github.com/StockerAPI/saudi-stock-market-api)
