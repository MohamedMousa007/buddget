# Wealth v3 — implementation notes (2026-10-16)

## Shipped
- `/wealth` is one scroll: `SavingsHero` (Flow band tokens) + `WealthHeroBadges` → Add money / Withdraw (brand-new: Add a holding / Add money) → `GoldPriceStrip` → `WealthList` with category chips → `ActivityLedger` (3 rows, follows the filter). Sticky band reuses `FlowStickyStrip`.
- Data: migration 0111 (`user_settings.wealth_gold_strip`, `net_worth_snapshots` + RLS). Model in `lib/savings/wealthModel.ts` (tested); 30-day trend from daily snapshots via `useNetWorthTrend` (hidden until two snapshots exist, never faked).
- Zakat: `nisabBasisChosen` (existing configs count as chosen), gold fallback applied at the call site (`zakatBasis.ts`); `zakat.ts` rules untouched.
- Library: `AmountField` (tokens, `compact`, unit/currency suffix), `CurrencyField` (symbol, compact), `CurrencySheet`, `CardActionMenu` (disabled + hint, 216px).
- New/edited sheets: `AddHoldingSheet`, `AssetFormSheet` (no "Where it is"), `EmergencyFundSheet` (Details + Set up/Edit), `ZakatSheet`, `ZakatBasisPrompt`, `AddSavingsSheetV3`, `WithdrawSheetV3`.
- Deleted: PocketsCarousel, PocketCard, InvestmentView, EmergencyFundCard, ZakatCard, NewPocketSheet, AddInvestmentSheet, UpdateBalanceSheet.

## Could not match / decisions
- Price deltas (▲ 38 etc.) omitted: no price history exists. Add when a prior-close price is stored.
- `ZakatBasisPrompt`: `Prompt` supports title, description and two buttons only, so Silver/Gold are two buttons (not a SegmentedControl), the hadith is in the description, and ✕ snoozes instead of saving gold (gold is already the fallback). Needs `Prompt.body`/`onClose` for exact parity.
- `PocketFormSheet` has no edit mode; Wealth still uses `EditSavingsAccountSheet` for Edit (kept, not deleted).
- Zakat year presets: Today / 1 Jan (no Hijri helper for 1 Ramadan).
- Emergency fund simple-month chips are exclusions persisted as `monthlyEssentials`; exclusions are not remembered on reopen.
- Money source ("This month" / "Already had it") is still not persisted beyond requiring a price and stamping the purchase date.
- Arabic strings are drafts (`// TODO(ar-review)`); sheets still have English-only legacy labels.
- Not visually verified: dark mode, RTL, and the other `AmountField` glass callers (PaymentMethodSetupSheet, PocketFormSheet) after the suffix change.
- Zakat badge is hidden when nisab prices are unavailable (no meaningful due amount).
