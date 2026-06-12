import type { BankPatternSet } from './types'

/**
 * Mashreq (UAE) — English NEO card alerts, sender `Mashreq`. Verified against a
 * real capture (pennywiseai MashreqBankParser). See docs/SMS_PATTERN_RESEARCH.md.
 */
export const MASHREQ_PATTERNS: BankPatternSet = {
  bank: 'Mashreq',
  senderIds: ['MASHREQ', 'MASHREQNEO'],
  patterns: [
    {
      // "Thank you for using NEO VISA Debit Card Card ending 1234 for AED 5.99 at
      //  CARREFOUR on 26-AUG-2025 10:25 PM. Available Balance is AED 1,480.15"
      // (the real fixture masks the last4 as XXXX — tolerate digits or X.)
      id: 'mashreq-card-purchase-en',
      regex: /ending\s+([X\d]{4})\s+for\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+at\s+(.+?)\s+on\s+\d{2}-[A-Z]{3}-\d{4}/i,
      kind: 'purchase',
      groups: { last4: 1, currency: 2, amount: 3, counterparty: 4 },
      paymentInstrument: 'card',
      verified: true,
    },
  ],
}
