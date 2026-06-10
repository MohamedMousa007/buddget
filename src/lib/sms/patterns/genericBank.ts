import type { BankPatternSet } from './types'

/**
 * Generic Egyptian bank card/account templates (hotline 19123 family) — the
 * sender ID is unconfirmed, so senderIds is empty and these patterns only run
 * in the fallback pass. Verified against real captures (money_tracking
 * fixtures). See docs/SMS_PATTERN_RESEARCH.md.
 */
export const GENERIC_BANK_PATTERNS: BankPatternSet = {
  bank: 'Bank',
  senderIds: [],
  patterns: [
    {
      // "You have a Trx on your Card no. XXXX2939 from Talabat for EGP  204.16
      //  on 19-May at 05:06  GMT+3 your available balance is 276.10 …"
      id: 'generic-card-trx-en',
      regex: /You\s+have\s+a\s+Trx\s+on\s+your\s+Card\s+no\.?\s*X*(\d{4})\s+from\s+(.+?)\s+for\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)/i,
      kind: 'purchase',
      groups: { last4: 1, counterparty: 2, currency: 3, amount: 4 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "تم إيداع EGP 7900 إلى حساب رقم #0014 يوم 06/04/2026 13:24 المتاح … "
      id: 'generic-deposit-ar',
      regex: /تم\s+إيداع\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+إلى\s+حساب\s+رقم\s*#?\s*(\d{4})\s+يوم\s+(\d{2}\/\d{2}\/\d{4})/,
      kind: 'income',
      groups: { currency: 1, amount: 2, last4: 3, datetime: 4 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "تم تحويل لحظى بمبلغ 200 إلى  رقم مرجعى BEC93BC في 17/05/2026 04:54 …"
      id: 'generic-ipn-out-ar',
      regex: /تم\s+تحويل\s+لحظ[يى]\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s+إلى\s+.*?رقم\s+مرجع[يى]\s+\S+\s+في\s+(\d{2}\/\d{2}\/\d{4})/,
      kind: 'instant_transfer_out',
      groups: { amount: 1, datetime: 2 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
  ],
}
