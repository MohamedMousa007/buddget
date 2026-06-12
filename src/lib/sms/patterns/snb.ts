import type { BankPatternSet } from './types'

/**
 * Saudi National Bank (SNB / AlAhli) — Arabic RTL, multi-line POS alerts,
 * sender `SNB-AlAhli`/`AlAhliBank`. Verified against a real capture
 * (pennywiseai SNBAlAhliBankParserTest). The amount is glued to the `بـ` prefix
 * and fields are line-separated. See docs/SMS_PATTERN_RESEARCH.md.
 */
export const SNB_PATTERNS: BankPatternSet = {
  bank: 'SNB AlAhli',
  senderIds: ['SNB-ALAHLI', 'SNB', 'ALAHLIBANK'],
  patterns: [
    {
      // "شراء نقاط بيع SamsungPay\nبـSAR 19.45\nمن filwah al\nمدى *2342\nفي 07:53 03/04/26"
      id: 'snb-pos-purchase-ar',
      regex: /شراء\s+نقاط\s+بيع[\s\S]*?بـ\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)[\s\S]*?من\s+([^\n]+?)\s*[\r\n][\s\S]*?مدى\s*\*?\s*(\d{4})/,
      kind: 'purchase',
      groups: { currency: 1, amount: 2, counterparty: 3, last4: 4 },
      paymentInstrument: 'card',
      verified: true,
    },
  ],
}
