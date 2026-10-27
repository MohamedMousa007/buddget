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
    {
      // "تم إضافة تحويل لحظي لحسابكم رقم 1234 بمبلغ 100.00 جم من NAME رقم مرجعي 999999999999 يوم 20-07 …"
      id: 'nbe-ipn-in-account-ar',
      regex: /تم\s+إضافة\s+تحويل\s+لحظي\s+لحسابكم\s+رقم\s+(\d{4})\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s*جم\s+من\s+(.+?)\s+رقم\s+مرجعي/,
      kind: 'instant_transfer_in',
      groups: { last4: 1, amount: 2, counterparty: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "تم تنفيذ تحويل لحظي من حسابكم رقم 1234 بمبلغ 100.00 جم إلى NAME رقم مرجعي 999999999999 …"
      id: 'nbe-ipn-out-account-ar',
      regex: /تم\s+تنفيذ\s+تحويل\s+لحظي\s+من\s+حسابكم\s+رقم\s+(\d{4})\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s*جم\s+إلى\s+(.+?)\s+رقم\s+مرجعي/,
      kind: 'instant_transfer_out',
      groups: { last4: 1, amount: 2, counterparty: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "تم رد تحويل لحظي لحسابكم رقم 1234 بمبلغ 100.00 جم رقم مرجعي 999999999999 …" (returned transfer)
      id: 'nbe-ipn-return-account-ar',
      regex: /تم\s+رد\s+تحويل\s+لحظي\s+لحسابكم\s+رقم\s+(\d{4})\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s*جم\s+رقم\s+مرجعي/,
      kind: 'refund',
      groups: { last4: 1, amount: 2 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
  ],
}
