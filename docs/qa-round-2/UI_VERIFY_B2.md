# B2 live UI verification

Setup: buddget-qa-local (port 3001, dev auth bypass, no Supabase), 375x812, light, English; dark and Arabic spot passes. Data seeded through window.__finance (3 accounts, expenses, receipt expense, debt + payment + paired expense, BNPL, card debt, gold debt, USD debt, EGP/gold/KWD pockets, BTC and gold holdings, goal, income events).

## Results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | Savings deposit "this month's budget" shows From account (primary default, hidden with no tracked accounts, hidden for Outside the budget) | PASS | Row "From account / CIB Current / 48,040 free"; picker lists both tracked accounts; with openingBalance cleared on both accounts the row disappeared, restored when set; hidden on "Outside the budget". Row 335x52. |
| 1b | Goal add-money sheet From account | PASS | Sheet text "From account / CIB Current / 48,040 free". |
| 1c | Withdraw sheet To account for Income purpose only | PASS | Shown for Income ("To account / CIB Current"), absent for Spending. |
| 2 | Zakat footer Done + Mark zakat as paid, confirm, Undo toast | PASS (with FAIL in 2b) | Footer buttons "Done" 155x48, "Mark zakat as paid" 168x48. Confirm alertdialog "Mark zakat as paid? This records 54,576 EGP..."; after Confirm zakatConfig.yearStartDate=today, toast "Zakat marked as paid / Undo"; Undo restored previous lastPaidDate. |
| 2b | Zakat sheet text correctness | FAIL | Verdict sub-line renders the literal text `2.5% × 2,183,022 {unit} zakatable`. ZakatSheet.tsx uses `{unit}` inside a template literal without `$` (should be `${unit}`). |
| 3 | Pocket delete confirm shows balance, Undo toast above dialog, Undo restores | PASS | Confirm: "Delete KWD pocket? ... 100 KWD will leave your net worth. You can undo for a few seconds." Toast "KWD pocket deleted / Undo"; toast container is position fixed z-200, dialogs are z-100/111; Undo restored pocket (3 pockets, balance 100). Not exercised with a pocket sheet open underneath (delete came from the card menu); z-order verified by computed style only. |
| 4a | Delete debt payment (swipe, confirm, paired expense removed, Undo restores both) | PASS | Confirm "Delete this payment? Its matching expense is deleted too..."; after Delete payments 1->0 and debt-payment expenses 1->0; toast "Payment and expense deleted / Undo"; Undo restored both. |
| 4b | Delete an expense that is a debt payment's pair | PASS | Confirm "Delete this debt payment? This expense is a debt payment. The payment is deleted too..."; expenses 6->5, payments 1->0; Undo restored 6 and 1. |
| 5 | Income swipe-delete in Flow shows Undo | PASS | Deleted immediately (no confirm), toast "Income deleted / Undo"; Undo restored the event. |
| 6 | Toast stack up to 3, Undo >=44px, pause on hover | PASS (partial) | Two stacked toasts observed (y=16 and 82), Undo button 63x44 on each. Hover: a hovered toast was still present after a 9.5 s wait (8 s undo lifetime) while non-hovered ones expired. The cap of 3 was not reproduced live (UI action latency let older toasts expire); verified from toastQueue.ts (MAX_TOASTS=3, TOAST_UNDO_MS=8000). Toasts overlay the header action buttons while visible (expected, fixed top). |
| 7 | Pay-debt currency defaults to debt currency, gold XAU | PASS | USD loan form: picker "$ USD", button "Pay 300 USD"; Gold loan: "Au XAU", "Pay 10 XAU". |
| 8 | Card setup validation + labels | PASS | Labels "OPENING BALANCE" (with hint) and "PAYMENT DUE DAY". Due day 0 and 32 each show role=alert "Enter a day from 1 to 31" and disable Save; 02 is accepted. |
| 9a | Edit debt with payments locks currency/gold | PASS | Hint "Currency and gold are locked because this debt has payments."; currency button disabled, Gold-backed switch aria-disabled. |
| 9b | Edit savings-linked income event amount locked | PASS | Hint "Linked to savings or a debt, so the amount and currency are locked."; amount input and currency disabled; Arabic string present and RTL layout fine. |
| 10 | Expense with receipt: View receipt opens detail | PASS | "View receipt" button 44px high; opens Receipt sheet with Spinneys breakdown (2x Milk, Bread, VAT). |
| 11a | Amount typing 1.25 then "." | PASS | Raw input events "1","1.","1.2","1.25","1.25." settle at "1.25"; second dot rejected. |
| 11b | "1,250" and "١٢٣٤" | PASS | Settles at 1250 and 1234. Intermediate per-keystroke DOM values not captured (typing is faster than the sampling timer), only final values. |
| 11c | KWD allows 3 decimals | FAIL (savings sheets) | In the Withdraw sheet with a KWD pocket, typing 1.2345 yields 1.23. AmountCurrencyRow (MoneySheetParts.tsx) renders AmountField without a currency prop, so 2 decimals. Same omission in AddBorrowForm, AddInstallmentForm, GoalEditSheet, StepMakeItReal (target/limit), AddLineSheet. Not re-tested in sheets that do pass currency (PocketFormSheet, GoalAddMoneySheet, AddAccountSheet). |
| 12 | WealthList decimals and negatives | PASS (partial) | "Bitcoin 0.0123 · Not priced", "Gold jewellery 2.5 g · Not priced". Negative pocket (-5 USD) renders "-280" in base EGP with a minus sign; the "-$5.00" form needs a USD base currency and was not seeded. |
| 13 | Buddgy first navigation consent | NOT RUN | The consent card needs a live AI tool call; no Buddgy entry point was available in bypass mode and no paid AI call was triggered. |

## Other findings

- FAIL (layout): Zakat line inputs are w-[84px]; "Cash & savings" with 2,188,674 is clipped ("2,188,67"). Chips Silver/Gold are 36 px high, Today/1 Jan 40 px (below 44; zakat rows are documented as deliberately 36 px).
- Targets under 44 px seen: sheet close buttons 32 px (pay-debt, edit debt, edit income "Edit income" icon 32 px), "Today" date chip 36 px in pay-debt and edit expense, "Add note" 28 px in edit expense. Likely pre-existing, not B2-specific.
- Layout: "This month's budget" segment label truncates ("This month's bud…") at 375 px in the savings deposit sheet.
- Pocket picker rounds a 12.5 g gold pocket balance to "13" in the Add money and Withdraw sheets.
- ZakatSheet body text and the nisab line are English-only in Arabic locale (only footer/confirm strings are translated).
- Dev-only: "Missing NEXT_PUBLIC_SUPABASE_URL" console.error from useAssetPrices on every mount (no Supabase in QA mode, caught). It raises the Next dev overlay and the overlay swallowed a tap once.
- My own seeding error (receipt items with wrong field names) crashed ReceiptDetailSheet at `.toFixed` of undefined (line 183) via the error boundary; not a B2 regression, but the sheet has no guard for legacy/malformed items.
- Console errors per sheet: none besides the Supabase env error above (all sheets listed here otherwise clean).
- Dark mode: edit-income sheet, zakat sheet, goal add-money sheet readable; locked note and disabled currency legible. No horizontal overflow at 375 px in any sheet checked.
