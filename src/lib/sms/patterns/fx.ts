import type { BankPatternSet } from './types'

/**
 * Currency-exchange SMS — converting between the user's own currency accounts
 * (e.g. USD → EGP). Banks typically send TWO messages (debit in source
 * currency, credit in destination currency); `pairing.ts` reconciles them so
 * the move is tracked once and never double-counts. Categorised non-spend
 * ("Currency Exchange"). Cross-currency amounts differ, so pairing does NOT
 * require equal amounts for this kind.
 */
export const FX_PATTERNS: BankPatternSet = {
  bank: 'Currency Exchange',
  senderIds: [],
  patterns: [
    {
      // "You have exchanged USD 100.00 from account ****1234." (debit leg)
      id: 'fx-debit-en',
      regex: /exchanged\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+from\s+(?:your\s+)?account\s+\*+(\d{4})/i,
      kind: 'currency_exchange',
      groups: { currency: 1, amount: 2, last4: 3 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "Currency conversion: EGP 4,800.00 credited to account ****5678." (credit leg)
      id: 'fx-credit-en',
      regex: /currency\s+conversion[:\s].{0,30}?([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+credited\s+to\s+(?:your\s+)?account\s+\*+(\d{4})/i,
      kind: 'currency_exchange',
      groups: { currency: 1, amount: 2, last4: 3 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "تم تحويل عملة بمبلغ USD 100.00 من حسابك ****1234"
      id: 'fx-ar',
      regex: /تم\s+تحويل\s+عملة\s+بمبلغ\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+حسابك\s+\*+(\d{4})/,
      kind: 'currency_exchange',
      groups: { currency: 1, amount: 2, last4: 3 },
      paymentInstrument: 'account',
      verified: true,
    },
  ],
}
