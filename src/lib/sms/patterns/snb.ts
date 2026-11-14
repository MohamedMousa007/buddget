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
      // "شراء PoS\nعبر:1234;مدى-ابل باي\nبـSAR 12.50\nلـACME STORE\n26/11/14 10:05"
      id: 'snb-compact-pos-purchase-ar',
      regex: /شراء\s+PoS\s+عبر:\s*(\d{4})\s*;\s*مدى-\S+(?:\s+باي)?\s+بـ\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+لـ\s*(.+?)[\s\u061C]+(\d{2}\/\d{2}\/\d{2})\s+\d{1,2}:\d{2}/,
      kind: 'purchase',
      groups: { last4: 1, currency: 2, amount: 3, counterparty: 4, datetime: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "شراء انترنت بطاقة:1234;مدى\nمن:5678\nمبلغ:SAR 12.50\nلدى:ACME STORE\nفي:26/11/14 10:05"
      id: 'snb-compact-online-purchase-ar',
      regex: /شراء\s+انترنت\s+بطاقة:\s*(\d{4})\s*;\s*مدى\s+من:\s*\d+\s+مبلغ:\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s+لدى:\s*(.+?)\s+في:\s*(\d{2}\/\d{2}\/\d{2})\s+\d{1,2}:\d{2}/,
      kind: 'online_purchase',
      groups: { last4: 1, currency: 2, amount: 3, counterparty: 4, datetime: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // "حوالة داخلية واردة بـSR 100\nلـ1234\nمن5678;ACME PERSON\n26/11/14 10:05"
      id: 'snb-compact-transfer-in-ar',
      regex: /حوالة\s+(?:داخلية|محلية)\s+واردة\s+بـ\s*SR\s*([\d,]+(?:\.\d+)?)\s+لـ\s*(\d{4})\s+من\s*(\d{4})\s*;\s*(.+?)[\s\u061C]+(\d{2}\/\d{2}\/\d{2})\s+\d{1,2}:\d{2}/,
      kind: 'instant_transfer_in',
      groups: { amount: 1, last4: 2, counterpartyLast4: 3, counterparty: 4, datetime: 5 },
      currencyLiteral: 'SAR',
      paymentInstrument: 'account',
      verified: true,
    },
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
