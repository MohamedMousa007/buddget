# QA Round 6 P3 closing: money (DEB, FUZ, RPW, TZL, FRM, REG)

Migration: 0254 `asset_prices_price_positive` (CHECK price > 0 and not NaN). Probed in a rolled-back DO block first (zero and NaN blocked), all 21 live rows pass, applied live. 0255 unused.
Tests: `src/lib/debts/__tests__/reminderRollback.test.ts`, `src/lib/savings/postRecurringSavings.test.ts`, `src/components/features/payments/graceFieldHidden.test.ts`, `src/lib/utils/fuzzHardening.test.ts`, `src/lib/prices/goldSanity.test.ts`, additions to `liveLinks.test.ts`, `reportsPeriod.test.ts`, `assetPriceLookup.test.ts`.

| ID | Status | What changed |
|---|---|---|
| DEB-6 | Already fixed | FUZ-4 (last installment pays the remainder). Regression test 100 over 48 clears on the 48th. |
| DEB-7 | Already fixed | FUZ-5 (`installmentPaymentsCompleted` returns the full count once paid). Regression test 1000 over 36 reads 36/36. |
| DEB-8 | Fixed | `deleteDebtPayment` rolls a single running reminder back to the deleted payment's date when that payment is the one that advanced it; snapshot `schedule` carries the pre-state so Undo advances it again (`useFinanceStore.ts`, `types.ts`). |
| DEB-9 | Fixed (month-based) | `scheduledDueDate` (recurringDebtPayments.ts) re-anchors a snoozed due date before advancing, used by `reconcileDebtSchedule`. Weekly/biweekly reminders have no anchor day and keep the old behaviour (a snooze shifts them); stated, not changed. |
| DEB-10 | Fixed | `liveLinks.debtExtras` uses `installmentPaymentsCompleted` (amount paid over per), same as the debt tab. |
| DEB-11 | Fixed (decision: hide) | Grace days field removed from `PaymentMethodSetupSheet`; value still stored and synced, nothing reads it. |
| DEB-12 | Fixed (decision: back-fill) | `postDueRecurringSavings` (new, `lib/savings/postRecurringSavings.ts`) posts each missed month (newest 3), each dated on its due date (new optional `date` on `depositToSavings`), deterministic ids. Hook now calls it. |
| FUZ-1, FUZ-2 | Already fixed | P2 pass (paydayCollisions). |
| FUZ-3 | Fixed | `formatters.ts`: non-finite renders as zero in every shared formatter, `formatCompact` no `-0`, `formatPercent` plain digits. Unused `fmtCompact` removed. |
| FUZ-5 | Already fixed | P2 pass. |
| FUZ-6 | Already fixed | P2 pass (Undo refused). |
| FUZ-7 | Fixed | `tryConvertCurrency` returns null for a non-finite amount or a non-finite result. |
| FUZ-8 | Fixed | `DEFAULT_MARKET_RATES` keeps only `AED_EGP` (reverse derived); every pair of USD/AED/EGP/EUR/GBP/SAR round-trips within 1e-9 (test). |
| RPW-3 | Fixed | `isReportSpendRow` drops refunded/declined rows from the report; CSV `counted` uses it. |
| RPW-4 | Fixed | `lookupAssetPrice`/`lookupAssetPriceDisplay` return null unless price is finite and > 0; migration 0254. |
| RPW-5 | Fixed | `freshness.ts` allows 5 min of device clock skew. |
| RPW-6 | Fixed | XAU/XAU_G carry the real spot consensus confidence; Gulf karat samples outside +-5% of spot x peg are dropped (`goldSanity.ts`); goldpricez no longer reads `ounce_price_24k` as a gram price. |
| RPW-9 | Fixed | `reportCycles('thisYear')` shows only the running cycle before this year's first cycle starts. |
| RPW-7 | Fixed | `utils/rateBands.ts` `plausibleRates` (per-currency band per USD), used by `/api/rates` `validRates`; test `rateBands.test.ts`. |
| RPW-8 | Fixed (decision: label) | Net cash flow is computed from expected income like "Money in (expected)"; its label now says "(expected)" in EN and AR (`netFlowLabel.test.ts`). |
| TZL-3, TZL-10, TZL-11 | Already fixed | P2 pass. |
| TZL-4 | Fixed | OTP/last4/due day/year search were closed in the P2 pass; this pass adds `SecondFactorGate` and `useAuthModal` OTP (`toLatinDigits` before the `\D` strip). `typedDigits.test.ts` scans components and hooks (admin portal is English-only, excluded) so a new unconverted strip fails. |
| TZL-5 | Fixed (main count nouns) | `arPlural.ts` gains units (week, account, card, entry, transaction, expense, change, item, line, recording, milestone, result, bankMessage); ~45 strings across `ar.ts`, onboarding, subscriptions, voice, budget blocks/builder/studio now go through `arCount` (days left/late, months, accounts, cards, messages, transactions...). Test `arPluralCoverage.test.ts` (1, 2, 3-10, 11+ samples). Left as is on purpose: strings whose number is money or a decimal (`ef.aboveTarget`, `ef.monthsOf`), ordinals ("day 11 payday"), and adjective counts ("N نشطًا"). |
| TZL-6 | Fixed | `rtl:rotate-180` on the Settings row chevron, sub-page back arrow, date picker prev/next, Paydays/PaydayDetail/PlanHistory back arrows, provider/card-setup back arrows, support inbox back, withdraw "move" arrow, activate arrow (`rtlDirection.test.ts`). Chevrons that already flipped were left alone (no global rule, it would double flip them). ShortcutsScenes (mock of Apple's UI) untouched. |
| TZL-7 | Fixed | Chip row fade gradient has an `rtl:` variant (`IncomeTypeChipSlider`). |
| TZL-8 | Fixed (listed sites) | `ms-[82px]`, `ms-1`, `me-1`, `text-start` in ExpenseDayList, ZakatSheet, PocketFormSheet, SavingsProductTypePicker, ActionToast `ps/pe`. Numeric right-aligned inputs and the converter badge keep physical sides (Latin numerals). |
| TZL-9 | Fixed | Seven `toLocaleString()` sites use `en-US` / `formatFixed2`; AccountDetailSheet date uses `formatLocalized` with the UI locale (`numeralConvention.test.ts`). |
| FRM-9..13 | Already fixed | P2 pass (forms closing). |
| REG-5 | Won't fix | A no-op upsert (rowcount 0) cannot be told from a stale skip without a RETURNING round trip that costs more than the one extra pull; it is bounded by the 3-pass cap and never loops. |
| REG-6 | Already fixed | Sync redesign (0240/0241). |
| REG-7 | Fixed | `serverClock`: the stored offset is `{o, at}` (key v2); ignored when the device clock moved backwards since it was learned or it is older than 3 days; the next pull re-learns. Tests in `serverClock.test.ts`. |
| REG-8 | Fixed | `0231` looks the job up by `jobname = 'cron-log-trim'` (same SQL result live); `migrationsHygiene.test.ts` fails on any numeric `cron.alter_job`/`unschedule`. |
| REG-9 | Fixed (consequences) | The bindings-before-password order stays (DBS-3 security decision: a bound device must not mint a session after the change). Fixed the two harms: a failed password update now mints a fresh SMS ingest token for this phone (the retired tokens would otherwise stop SMS), and the client clears local biometric on the 502 `passwordChanged` path. Tests `passwordChange.test.ts`, `changePassword.test.ts`. A failed update still costs re-enrolling biometric and 2-step trust. |
| REG-10 | Fixed | `buddget:flushed:` was already wiped on sign-out (P2). Row hash is now two 32-bit hashes plus length (64 bits); fingerprint carries `v: 2`, an older stored fingerprint is ignored so the upgrade does not re-send every row (`flushedFingerprint.test.ts`). The size of the fingerprint at 40k rows is unchanged in kind and not reduced. |
| REG-11 | Fixed (visibility only) | Month-carry stops starting users after 50 s, logs, and answers `partial: true, nextCursor`; `?after=<user_id>` resumes. A persisted cursor / fan-out is not built (39 users today); the cron still restarts at the first user, so beyond about a thousand users the tail needs that design. Test in `monthCarryDryRun.test.ts`. |
| REG-12 | Won't fix | Deliberate (BAI-1, 0247): failed chat turns do not burn the user's daily cap; abuse is bounded by the rate limit and the hop cap (0256). |
| REG-13 | Owner decision | Whether PostgREST returns a count for a minimal-return upsert needs a live call with a real user session; not probeable here. The guard fails safe (no count = no extra re-pull; flush passes and pull cursors are unchanged). |

## Verification
`npx tsc --noEmit` clean. eslint on every changed `src/` file: 0 errors. Full `vitest run`: 568 files / 4888 tests in Africa/Cairo, 4899 in America/New_York, all pass. Migration 0254 applied live (rolled-back probe first; 21 of 21 rows valid). 0255 unused.
