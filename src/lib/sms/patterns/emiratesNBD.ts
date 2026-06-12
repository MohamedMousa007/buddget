import type { BankPatternSet } from './types'

/**
 * Emirates NBD (UAE) — English alerts, sender `EmiratesNBD`/`ENBD`. Verified
 * against real captures (pennywiseai EmiratesNBDParserTest). Card purchases,
 * account debits, and account credits each have a distinct shape.
 * See docs/SMS_PATTERN_RESEARCH.md.
 */
export const EMIRATES_NBD_PATTERNS: BankPatternSet = {
  bank: 'Emirates NBD',
  senderIds: ['EMIRATESNBD', 'ENBD', 'EMIRATESNB'],
  patterns: [
    {
      // "Purchase of AED 27.74 with Credit Card ending 9074 at Keeta, Dubai.
      //  Avl Cr. Limit is AED 30,978.13" / "... USD 100.00 ... at Amazon.com. Avl"
      id: 'enbd-card-purchase-en',
      regex: /Purchase\s+of\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+with\s+Credit\s+Card\s+ending\s+(\d{4})\s+at\s+(.+?)\.\s+Avl/i,
      kind: 'purchase',
      groups: { currency: 1, amount: 2, last4: 3, counterparty: 4 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "AED 500.00 debited from A/C xxxx1234 on 24-Dec-25. Avl Bal is AED 15,234.50"
      id: 'enbd-account-debit-en',
      regex: /([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+debited\s+from\s+A\/C\s+[xX*]+(\d{4})/,
      kind: 'other',
      groups: { currency: 1, amount: 2, last4: 3 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "AED 2,500.00 credited to A/C xxxx5678 on 24-Dec-25. Available Balance: AED 25,750.00"
      id: 'enbd-account-credit-en',
      regex: /([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+credited\s+to\s+A\/C\s+[xX*]+(\d{4})/,
      kind: 'instant_transfer_in',
      groups: { currency: 1, amount: 2, last4: 3 },
      paymentInstrument: 'account',
      verified: true,
    },
  ],
}
