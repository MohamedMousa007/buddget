# QA Round 6: reports-wealth (RPW)

Covered: reports pipeline (useReportsPage, reportsPeriod, CSV export, pie/bar helpers), net worth, wealth model, holding valuation, zakat, the price pipeline (/api/gold, /api/rates, /api/prices/refresh, /api/cron/prices), net_worth_snapshots, goals progress/allocation/achieved reconcile, and the scheduled month-carry cron. Not covered: live UI render, PDF export (none exists), Sagha HTML scrapers, goal AI/chat, PlanHistoryPage render, native share path.
Repros: `docs/qa-round-6/repro/reports-wealth/{reports,wealth,carry}.test.ts.txt` (copy to `src/__qa6__/reports-wealth/` without `.txt`). Failing tests there are the defect demos; results identical in Cairo, New York and Riyadh.

| ID | P | file:line | finding | evidence | suggested fix | status |
|---|---|---|---|---|---|---|
| RPW-1 | P2 | src/app/api/cron/month-carry/route.ts (`resolveCarryDestination(..., goals.filter(g => g.fundingMode === 'manual'))`), src/lib/savings/monthCarry.ts `goalPocketIds` | The cron passes only MANUAL goals, so the auto-created pockets of FUNDED (share/fixed) goals are never treated as owned. With no default pocket and no manual goal, the "shared vault no goal owns" resolves to a funded goal's own pocket; the surplus is deposited there, inflating that goal's progress and possibly flipping it to achieved. The cron is scheduled daily and writes live money | carry.test.ts "unassigned carry lands in a FUNDED goal's auto-created pocket": expected `create-vault`, got `pocket`. Live SQL: 0 users match today (latent) | pass all active goals to `resolveCarryDestination` | Confirmed |
| RPW-2 | P2 | monthCarry.ts `isEligibleCarryPocket`; cycleCarryFigures.ts (`extraCurrencies`, null); cron `carryUser` (`else break`) | A gold (XAU) pocket is an eligible destination; `cycleCarryFigures` returns null (no server gram quote), `carryCycle` returns false with no summary row, `carryUser` breaks: the carry silently never runs and newer cycles queue behind it until it slides out of the 3-cycle window (that cycle's carry is lost). Only a console.error | carry.test.ts "manual goal linked to a gold pocket". Live: 0 XAU default/goal pockets (latent) | exclude XAU/BTC/ETH pockets in `isEligibleCarryPocket`; write a skipped summary or continue instead of break | Confirmed (unit) |
| RPW-3 | P3 | calculations.ts:963 `getPaymentMethodBreakdown`; useReportsPage.ts; CSV `counted` | `reportSpendRows` keeps refunded/declined rows (`isNonSpendExpense` ignores `refundKind`): totals right (0) but they count as purchases in "Go-to payment method", appear as 0-value pie slices, can be "Biggest purchase (0)"; CSV says counted=yes. Buddgy drops them, so surfaces disagree | reports.test.ts | filter `refundKind` in `reportSpendRows` (keep in CSV only) | Confirmed |
| RPW-4 | P3 | assetPriceLookup.ts `lookupAssetPrice`; useAssetPrices `Number(r.price)`; asset_prices has no CHECK | A cached price of 0, negative or NaN is served as live (valueGold gives 0, priced true). Needs a bad write (all parsers guard > 0) | wealth.test.ts | return null unless finite and > 0; add `CHECK (price > 0)` | Confirmed |
| RPW-5 | P3 | freshness.ts `age >= 0` | `as_of` ahead of the device clock makes the price unavailable, so gold/crypto holdings flip to "not counted" | wealth.test.ts asOf = now+5s | allow ~5 min negative skew | Confirmed |
| RPW-6 | P3 | runPriceRefresh.ts (XAU/XAU_G `confidence:'high'`); fetchKeyed.ts; goldpricez.ts | (a) XAU rows are always 'high' though consensus can be single/low. (b) Gulf AED/SAR karat prices have no sanity check vs spot x peg; `parseGoldpricezGram24k` accepts `ounce_price_24k` as a gram price (31x) | parser + consensus tests (9,999,999 accepted); live rows coherent (0.4% off) | propagate real confidence; reject outside +-5% of spot x peg; drop ounce key | Confirmed (parser) |
| RPW-7 | P3 | api/rates/route.ts `validRates`; marketData `updateRates` | Only finite > 0 is checked: a provider value like EGP=1e-6 or 1e9 becomes every cross rate, edge-cached 2h (same class as FUZ-7). Gold is range-checked, FX is not | static | plausibility band or reject >50% jump vs last table | Static |
| RPW-8 | P3 | useReportsPage.ts (`periodRecurringIncome - totalExpenses`) | "Net cash flow" uses EXPECTED income (incl. unreceived paydays) while the hero shows "received so far" | static | use received income for the current cycle or label "projected" | Static |
| RPW-9 | P3 | reportsPeriod.ts `reportCycles('thisYear')` | With monthStartDay > 1, from Jan 1 to the start day "This year" shows last year's 12 cycles | fuzz | clamp to cycles starting this calendar year (product call) | Confirmed |

## Verified clean
| Invariant / check | how verified | result |
|---|---|---|
| CSV cells cannot run as formulas (= + - @ TAB CR); quotes doubled; Arabic/commas/newlines quoted; BOM | reports.test.ts 12 probes | pass |
| Report presets contain today and consecutive cycles tile, start day 1..31 | fuzz 4,000 dates x 31 start days x 5 presets x 3 TZ | pass |
| Category totals, grand total, date window equal a naive reference | 20,000-row differential | pass |
| Pie foldTail keeps total and caps 6 slices; axisTick never "0k" or -0 | reports.test.ts | pass |
| Net worth equals an independent reference (fiat, USD, XAU, BTC, gold holding by karat, property, flow, debt) | wealth.test.ts | pass |
| Gold unavailable: XAU excluded, incomplete flag set, grams never counted as money | wealth.test.ts | pass |
| Karat/unit maths round trip; unpriced karat fails closed | wealth.test.ts | pass |
| Staleness edge, valuation tier fail-closed vs display tier stale-flagged | wealth.test.ts | pass |
| Consensus: disagreeing providers give low median, never high | test + read | pass |
| /api/gold 5-provider fallback and band | code read | pass |
| Price refresh stampede-safe (atomic claim, debounce, lock, idempotent, CRON_SECRET) | code read | pass |
| asset_prices RLS, SELECT-only, 20 rows all > 0, unique (symbol,currency) | read-only SQL | pass (no CHECK: RPW-4) |
| net_worth_snapshots: PK (user,day), 0 future, 4 own-row policies, trend null under 2 points | SQL + tests | pass |
| Zakat: nothing due without nisab feed, property excluded | test + read | pass |
| Month-carry idempotency (run-row claim, group key, dedupe), paging, fail-closed without FX | code read | pass (see RPW-1/2) |
| Base-currency switch re-denominates stored gram price | code read | pass |

Coverage: read fully: useReportsPage, reportsPeriod, exportFile, escapeCsvField, Reports panels, netWorth, wealthModel, holdingValuation, savingsConversions, zakat, useNetWorth(+Trend), the price pipeline and its API routes, marketData, gold store actions, computeGoalProgress, allocateMonth, reconcileAchievedGoals, month-carry cron, monthCarry, cycleCarryFigures, pocketLedger. Skimmed: calculations.ts, Buddgy exec/reports.ts, SpendingPacePanel.
Skills used: unit-testing, exploratory-testing, risk-based-testing, test-data-management.
