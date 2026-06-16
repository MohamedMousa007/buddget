import type { BankPatternSet } from './types'

/**
 * Transfer between the user's OWN accounts at the same bank — cross-bank phrasings.
 *
 * Detection here is a hint only; the authoritative own-account decision happens
 * in `pairing.ts` (matching source/destination last4 against the user's
 * registered payment methods, or pairing an outflow+inflow within a window).
 * Categorised non-spend ("Transfer"). The `counterpartyLast4` group feeds the
 * own-account registry match.
 */
export const OWN_TRANSFER_PATTERNS: BankPatternSet = {
  bank: 'Transfer',
  senderIds: [],
  patterns: [
    {
      // "Transfer of EGP 1,000.00 from your account ****1234 to your account ****5678."
      id: 'own-transfer-en',
      regex: /transfer\s+of\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+from\s+your\s+account\s+\*+(\d{4})\s+to\s+your\s+account\s+\*+(\d{4})/i,
      kind: 'own_transfer',
      groups: { currency: 1, amount: 2, last4: 3, counterpartyLast4: 4 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "تم تحويل مبلغ EGP 1,000.00 من حسابك ****1234 إلى حسابك ****5678"
      id: 'own-transfer-ar',
      regex: /تم\s+تحويل\s+مبلغ\s+([A-Z]{3})?\s*([\d,]+(?:\.\d+)?)\s*(?:جنيه|جم)?\s+من\s+حسابك\s+\*+(\d{4})\s+إلى\s+حسابك\s+\*+(\d{4})/,
      kind: 'own_transfer',
      groups: { currency: 1, amount: 2, last4: 3, counterpartyLast4: 4 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
  ],
}
