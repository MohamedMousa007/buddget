import type { BankPatternSet } from './types'

/**
 * Credit-card payoff / settlement SMS — cross-bank.
 *
 * These are payments TOWARD a credit card (settling the statement), not card
 * purchases. They are routed to a debt payment against the linked credit-card
 * debt and categorised non-spend ("CC Payoff"). Card-purchase SMS keep their
 * existing `purchase` patterns and are unaffected.
 */
export const CC_PAYOFF_PATTERNS: BankPatternSet = {
  bank: 'Credit Card',
  senderIds: [],
  patterns: [
    {
      // "Payment of EGP 5,000.00 received for your credit card ending 1234."
      id: 'cc-payoff-en-received',
      regex: /payment\s+of\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+received\s+for\s+your\s+credit\s*card\s+(?:ending|no\.?|#|\*+)\s*(\d{4})/i,
      kind: 'cc_payoff',
      groups: { currency: 1, amount: 2, last4: 3 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "Thank you. Your credit card payment of EGP 5,000.00 has been received."
      id: 'cc-payoff-en-thankyou',
      regex: /credit\s*card\s+payment\s+of\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+(?:has\s+been\s+)?received/i,
      kind: 'cc_payoff',
      groups: { currency: 1, amount: 2 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "تم سداد مبلغ EGP 5,000.00 لبطاقتك الائتمانية المنتهية بـ ****1234"
      id: 'cc-payoff-ar',
      regex: /تم\s+سداد\s+مبلغ\s+([A-Z]{3})?\s*([\d,]+(?:\.\d+)?)\s*(?:جنيه|جم)?\s+(?:إلى|ل)?بطاقتك?\s+الائتمانية(?:\s+المنتهية\s+بـ?\s*\*+(\d{4}))?/,
      kind: 'cc_payoff',
      groups: { currency: 1, amount: 2, last4: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'card',
      verified: true,
    },
  ],
}
