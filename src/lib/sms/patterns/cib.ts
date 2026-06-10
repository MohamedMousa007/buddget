import type { BankPatternSet } from './types'

/**
 * CIB (Commercial International Bank) — sender ID "CIB", hotline 19666.
 * Verified patterns from real user captures (pennywiseai #106, FinFast
 * CIBParser device captures). See docs/SMS_PATTERN_RESEARCH.md.
 */
export const CIB_PATTERNS: BankPatternSet = {
  bank: 'CIB',
  senderIds: ['CIB', 'EG-CIB', 'EG-CIB-B'],
  patterns: [
    {
      // "Your credit card ending with#8016 was charged for EGP 118.00 at
      //  SAOOD MARKET on 24/11/25  at 18:27." / "Your credit card #8810 was
      //  charged for USD 22.80 at ANTHROPIC CLAU on 01/06/26 at 15:26."
      id: 'cib-cc-purchase-en',
      regex: /credit\s+card\s+(?:ending\s+with\s*)?#\s*(\d{4})\s+was\s+charged\s+for\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+at\s+(.+?)\s+on\s+(\d{2}\/\d{2}\/\d{2,4})/i,
      kind: 'purchase',
      groups: { last4: 1, currency: 2, amount: 3, counterparty: 4, datetime: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "تم خصم EGP 10.00 من بطاقة الخصم المباشر # **2326 باستخدام Apple Pay
      //  عند CITYSTARS FOR MANAGEME في 23/05/26 16:24 الرصيد المتاح EGP2700.03."
      id: 'cib-debit-pos-ar',
      regex: /تم\s+خصم\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+بطاقة\s+الخصم\s+المباشر\s*#?\s*\*+(\d{4})(?:\s+باستخدام\s+\S+(?:\s+\S+)?)?\s+عند\s+(.+?)\s+في\s+(\d{2}\/\d{2}\/\d{2,4})/,
      kind: 'purchase',
      groups: { currency: 1, amount: 2, last4: 3, counterparty: 4, datetime: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "تم سحب مبلغ EGP 100.00 من بطاقة الخصم المباشر المنتهية بـ **2326
      //  من BDC HORYA في 19/05/26 19:55 ، الرصيد المتاح EGP 200.11"
      id: 'cib-atm-ar',
      regex: /تم\s+سحب\s+مبلغ\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+من\s+بطاقة\s+الخصم\s+المباشر\s+المنتهية\s+بـ?\s*\*+(\d{4})\s+من\s+(.+?)\s+في\s+(\d{2}\/\d{2}\/\d{2,4})/,
      kind: 'atm_withdrawal',
      groups: { currency: 1, amount: 2, last4: 3, counterparty: 4, datetime: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 1000.00 جم من حسابك
      //  المنتهي بـ ****1065 برقم مرجعي 819a53fa بتاريخ 26-05-2026 19:35 …"
      id: 'cib-ipn-out-ar',
      regex: /تم\s+تنفيذ\s+تحويل\s+لحظي\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s*جم\s+من\s+حسابك\s+المنتهي\s+بـ?\s*\*+(\d{4})\s+برقم\s+مرجعي\s+\S+\s+بتاريخ\s+(\d{2}-\d{2}-\d{4})/,
      kind: 'instant_transfer_out',
      groups: { amount: 1, last4: 2, datetime: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "… تم تنفيذ تحويل لحظي بمبلغ 10.00 جم إلى حسابك المنتهي بـ ********1065
      //  من KARIM MOHAMED MORSI ISM برقم مرجعي 1ac56f40 بتاريخ 31-05-2026 05:21 …"
      id: 'cib-ipn-in-ar',
      regex: /تم\s+تنفيذ\s+تحويل\s+لحظي\s+بمبلغ\s+([\d,]+(?:\.\d+)?)\s*جم\s+إلى\s+حسابك\s+المنتهي\s+بـ?\s*\*+(\d{4})\s+من\s+(.+?)\s+برقم\s+مرجعي\s+\S+\s+بتاريخ\s+(\d{2}-\d{2}-\d{4})/,
      kind: 'instant_transfer_in',
      groups: { amount: 1, last4: 2, counterparty: 3, datetime: 4 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "The transaction on your credit card#8016 from ORACLE IRELAND with
      //  EUR .93 on 15/11/25 at 05:14 has been refunded."
      id: 'cib-cc-refund-en',
      regex: /transaction\s+on\s+your\s+credit\s+card\s*#?\s*(\d{4})\s+from\s+(.+?)\s+with\s+([A-Z]{3})\s+(\.?[\d,]*\.?\d+)\s+on\s+(\d{2}\/\d{2}\/\d{2,4}).*?has\s+been\s+refunded/i,
      kind: 'refund',
      groups: { last4: 1, counterparty: 2, currency: 3, amount: 4, datetime: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
  ],
}
