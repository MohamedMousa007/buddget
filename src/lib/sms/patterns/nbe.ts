import type { BankPatternSet } from './types'

/**
 * NBE (National Bank of Egypt) — hotline 19888. Instapay card credits arrive
 * as "تم إضافة تحويل لحظي الي بطاقة رقم …". The sender ID is often stripped by
 * the iOS Shortcuts bridge, so these patterns must match on body alone (they
 * run in the sender-agnostic fallback pass). See docs/SMS_PATTERN_RESEARCH.md.
 */
export const NBE_PATTERNS: BankPatternSet = {
  bank: 'NBE',
  senderIds: ['NBE', 'EG-NBE', 'AlAhly', 'NBE-EG'],
  patterns: [
    {
      // "تم إضافة تحويل لحظي الي بطاقة رقم 507803******6685 بمبلغ 2 من MOHAMED
      //  MOUSSA ABDELLATIF رقم مرجعي 222267828819يوم 2026-06-12 الساعه 22:32 …"
      id: 'nbe-ipn-in-card-ar',
      regex: /تم\s+إضافة\s+تحويل\s+لحظي\s+(?:الي|إلى|الى|إلي)\s+بطاقة\s+رقم\s+\d+\*+(\d{4})\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s+من\s+(.+?)\s+رقم\s+مرجعي/,
      kind: 'instant_transfer_in',
      groups: { last4: 1, amount: 2, counterparty: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'card',
      verified: true,
    },
  ],
}
