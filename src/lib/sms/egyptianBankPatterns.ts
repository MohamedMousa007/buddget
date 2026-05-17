/**
 * SMS sender patterns and parsing rules for Egyptian banks and payment services.
 *
 * Each `SmsRule` defines:
 *   - `senderPattern` — matches the sender shortcode / phone number
 *   - `bodyPattern`   — identifies the SMS type and extracts named capture groups
 *                       ({amount}, {currency}, {merchant}, {last4})
 *   - `type`          — the resulting SmsTransactionType
 *   - `bankName`      — display name shown in the UI
 *
 * Rules are checked in order; the first match wins.
 * Amount capture groups always use a decimal-optional format like `1,234.56` or `1234`.
 */

import type { SmsTransactionType } from '@/lib/sms/transactionTypes'

export interface SmsRule {
  senderPattern: RegExp
  bodyPattern: RegExp
  type: SmsTransactionType
  bankName: string
  /** Currency if not captured from body (defaults to EGP when absent). */
  defaultCurrency?: string
}

// ─── Shared regex building blocks ────────────────────────────────────────────

/** Matches amounts like 1,234.56 or 1234 or 1234.5 — named group 'amount'. */
const AMT = '(?<amount>[\\d,]+(?:\\.\\d{1,4})?)'
/** Matches EGP or USD or EUR etc. — named group 'currency'. */
const CUR = '(?<currency>[A-Z]{2,4})'
/** Loose merchant capture — named group 'merchant'. */
const MER = '(?<merchant>[^.\\n]{3,60}?)'

// ─── Rules ───────────────────────────────────────────────────────────────────

export const EGYPTIAN_SMS_RULES: SmsRule[] = [
  // ── CIB (Commercial International Bank) ──────────────────────────────────
  {
    senderPattern: /^(CIB|01000010000)$/i,
    bodyPattern: new RegExp(`purchase\\s+of\\s+${AMT}\\s+${CUR}\\s+(?:at|from)\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'CIB Egypt',
  },
  {
    senderPattern: /^(CIB|01000010000)$/i,
    bodyPattern: new RegExp(`online\\s+(?:purchase|payment)\\s+of\\s+${AMT}\\s+${CUR}\\s+(?:at|from)?\\s*${MER}`, 'i'),
    type: 'online_charge',
    bankName: 'CIB Egypt',
  },
  {
    senderPattern: /^(CIB|01000010000)$/i,
    bodyPattern: new RegExp(`transfer(?:red)?\\s+${AMT}\\s+${CUR}\\s+(?:to|from)\\s+${MER}`, 'i'),
    type: 'transfer_out',
    bankName: 'CIB Egypt',
  },
  {
    senderPattern: /^(CIB|01000010000)$/i,
    bodyPattern: new RegExp(`received\\s+${AMT}\\s+${CUR}\\s+from\\s+${MER}`, 'i'),
    type: 'transfer_in',
    bankName: 'CIB Egypt',
  },
  {
    senderPattern: /^(CIB|01000010000)$/i,
    bodyPattern: new RegExp(`atm\\s+(?:withdrawal|cash)\\s+of\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'atm_withdrawal',
    bankName: 'CIB Egypt',
  },

  // ── Banque Misr ───────────────────────────────────────────────────────────
  {
    senderPattern: /^(Banque-?Misr|BM|01000666668)$/i,
    bodyPattern: new RegExp(`(?:تم|عملية)\\s*(?:شراء|بيع).*?${AMT}\\s*(?:${CUR}|جنيه)`, 'i'),
    type: 'purchase',
    bankName: 'Banque Misr',
    defaultCurrency: 'EGP',
  },
  {
    senderPattern: /^(Banque-?Misr|BM|01000666668)$/i,
    bodyPattern: new RegExp(`purchase\\s+${AMT}\\s+${CUR}\\s+at\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'Banque Misr',
  },
  {
    senderPattern: /^(Banque-?Misr|BM|01000666668)$/i,
    bodyPattern: new RegExp(`online\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'online_charge',
    bankName: 'Banque Misr',
  },
  {
    senderPattern: /^(Banque-?Misr|BM|01000666668)$/i,
    bodyPattern: new RegExp(`(?:سحب|atm).*?${AMT}`, 'i'),
    type: 'atm_withdrawal',
    bankName: 'Banque Misr',
    defaultCurrency: 'EGP',
  },
  {
    senderPattern: /^(Banque-?Misr|BM|01000666668)$/i,
    bodyPattern: new RegExp(`(?:تحويل|transfer).*?${AMT}`, 'i'),
    type: 'transfer_out',
    bankName: 'Banque Misr',
    defaultCurrency: 'EGP',
  },

  // ── National Bank of Egypt (NBE) ─────────────────────────────────────────
  {
    senderPattern: /^(NBE|National-?Bank|01001234567)$/i,
    bodyPattern: new RegExp(`purchase\\s+${AMT}\\s+${CUR}\\s+at\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'National Bank of Egypt',
  },
  {
    senderPattern: /^(NBE|National-?Bank|01001234567)$/i,
    bodyPattern: new RegExp(`online.*?${AMT}\\s+${CUR}`, 'i'),
    type: 'online_charge',
    bankName: 'National Bank of Egypt',
  },
  {
    senderPattern: /^(NBE|National-?Bank|01001234567)$/i,
    bodyPattern: new RegExp(`atm.*?${AMT}`, 'i'),
    type: 'atm_withdrawal',
    bankName: 'National Bank of Egypt',
    defaultCurrency: 'EGP',
  },
  {
    senderPattern: /^(NBE|National-?Bank|01001234567)$/i,
    bodyPattern: new RegExp(`transfer.*?${AMT}`, 'i'),
    type: 'transfer_out',
    bankName: 'National Bank of Egypt',
    defaultCurrency: 'EGP',
  },

  // ── QNB Alahli ───────────────────────────────────────────────────────────
  {
    senderPattern: /^(QNB|01007777777)$/i,
    bodyPattern: new RegExp(`purchase\\s+${AMT}\\s+${CUR}\\s+at\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'QNB Alahli',
  },
  {
    senderPattern: /^(QNB|01007777777)$/i,
    bodyPattern: new RegExp(`transfer.*?${AMT}`, 'i'),
    type: 'transfer_out',
    bankName: 'QNB Alahli',
    defaultCurrency: 'EGP',
  },

  // ── HSBC Egypt ───────────────────────────────────────────────────────────
  {
    senderPattern: /^(HSBC|01001000000)$/i,
    bodyPattern: new RegExp(`purchase\\s+of\\s+${AMT}\\s+${CUR}\\s+at\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'HSBC Egypt',
  },
  {
    senderPattern: /^(HSBC|01001000000)$/i,
    bodyPattern: new RegExp(`online.*?${AMT}\\s+${CUR}`, 'i'),
    type: 'online_charge',
    bankName: 'HSBC Egypt',
  },

  // ── Alex Bank ────────────────────────────────────────────────────────────
  {
    senderPattern: /^(Alex-?Bank|ALEXBANK)$/i,
    bodyPattern: new RegExp(`purchase\\s+${AMT}\\s+${CUR}\\s+at\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'Alex Bank',
  },

  // ── Standard Chartered Egypt ─────────────────────────────────────────────
  {
    senderPattern: /^(SC-?Egypt|SCB|StandardChartered)$/i,
    bodyPattern: new RegExp(`purchase\\s+${AMT}\\s+${CUR}\\s+at\\s+${MER}`, 'i'),
    type: 'purchase',
    bankName: 'Standard Chartered Egypt',
  },

  // ── InstaPay ─────────────────────────────────────────────────────────────
  {
    senderPattern: /^(InstaPay|Instapay|3799)$/i,
    bodyPattern: new RegExp(`sent\\s+${AMT}\\s+${CUR}\\s+to\\s+${MER}`, 'i'),
    type: 'instapay_out',
    bankName: 'InstaPay',
  },
  {
    senderPattern: /^(InstaPay|Instapay|3799)$/i,
    bodyPattern: new RegExp(`received\\s+${AMT}\\s+${CUR}\\s+from\\s+${MER}`, 'i'),
    type: 'instapay_in',
    bankName: 'InstaPay',
  },
  {
    senderPattern: /^(InstaPay|Instapay|3799)$/i,
    bodyPattern: new RegExp(`transfer(?:red)?\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'instapay_out',
    bankName: 'InstaPay',
  },

  // ── Fawry ─────────────────────────────────────────────────────────────────
  {
    senderPattern: /^(Fawry|fawry|16030)$/i,
    bodyPattern: new RegExp(`paid\\s+${AMT}\\s+${CUR}\\s+(?:for|to)?\\s*${MER}`, 'i'),
    type: 'bill_payment',
    bankName: 'Fawry',
  },
  {
    senderPattern: /^(Fawry|fawry|16030)$/i,
    bodyPattern: new RegExp(`payment\\s+of\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'bill_payment',
    bankName: 'Fawry',
  },

  // ── Vodafone Cash ─────────────────────────────────────────────────────────
  {
    senderPattern: /^(VF-?Cash|Vodafone-?Cash|Vodafone|2222)$/i,
    bodyPattern: new RegExp(`(?:sent|transferred)\\s+${AMT}\\s+${CUR}\\s+to\\s+${MER}`, 'i'),
    type: 'wallet_out',
    bankName: 'Vodafone Cash',
  },
  {
    senderPattern: /^(VF-?Cash|Vodafone-?Cash|Vodafone|2222)$/i,
    bodyPattern: new RegExp(`received\\s+${AMT}\\s+${CUR}\\s+from\\s+${MER}`, 'i'),
    type: 'wallet_in',
    bankName: 'Vodafone Cash',
  },
  {
    senderPattern: /^(VF-?Cash|Vodafone-?Cash|Vodafone|2222)$/i,
    bodyPattern: new RegExp(`(?:paid|دفع)\\s+${AMT}`, 'i'),
    type: 'wallet_out',
    bankName: 'Vodafone Cash',
    defaultCurrency: 'EGP',
  },

  // ── Orange Money ─────────────────────────────────────────────────────────
  {
    senderPattern: /^(Orange-?Money|OrangeMoney|4444)$/i,
    bodyPattern: new RegExp(`(?:sent|transferred)\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'wallet_out',
    bankName: 'Orange Money',
  },
  {
    senderPattern: /^(Orange-?Money|OrangeMoney|4444)$/i,
    bodyPattern: new RegExp(`received\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'wallet_in',
    bankName: 'Orange Money',
  },

  // ── Etisalat Cash (e& money) ─────────────────────────────────────────────
  {
    senderPattern: /^(Etisalat-?Cash|EteisalatMoney|eMoney|5555)$/i,
    bodyPattern: new RegExp(`(?:sent|paid)\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'wallet_out',
    bankName: 'e& Money',
  },

  // ── ValU (BNPL) ───────────────────────────────────────────────────────────
  {
    senderPattern: /^(ValU|valu)$/i,
    bodyPattern: new RegExp(`instalment\\s+(?:of\\s+)?${AMT}\\s+${CUR}`, 'i'),
    type: 'installment',
    bankName: 'ValU',
  },
  {
    senderPattern: /^(ValU|valu)$/i,
    bodyPattern: new RegExp(`payment\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'installment',
    bankName: 'ValU',
  },

  // ── Sympl (BNPL) ──────────────────────────────────────────────────────────
  {
    senderPattern: /^(Sympl|sympl)$/i,
    bodyPattern: new RegExp(`instalment\\s+(?:of\\s+)?${AMT}\\s+${CUR}`, 'i'),
    type: 'installment',
    bankName: 'Sympl',
  },
  {
    senderPattern: /^(Sympl|sympl)$/i,
    bodyPattern: new RegExp(`payment\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'installment',
    bankName: 'Sympl',
  },

  // ── Amazon.eg ────────────────────────────────────────────────────────────
  {
    senderPattern: /^(Amazon\.?eg|Amazon-?Egypt)$/i,
    bodyPattern: new RegExp(`charged\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'online_charge',
    bankName: 'Amazon Egypt',
  },
  {
    senderPattern: /^(Amazon\.?eg|Amazon-?Egypt)$/i,
    bodyPattern: new RegExp(`order.*?${AMT}\\s+${CUR}`, 'i'),
    type: 'online_charge',
    bankName: 'Amazon Egypt',
  },

  // ── Uber Egypt ───────────────────────────────────────────────────────────
  {
    senderPattern: /^(Uber|UberEgypt)$/i,
    bodyPattern: new RegExp(`charged\\s+${AMT}\\s+${CUR}`, 'i'),
    type: 'online_charge',
    bankName: 'Uber Egypt',
  },

  // ── Generic bank fee fallback (any sender) ───────────────────────────────
  {
    senderPattern: /./,   // matches any sender — must be last
    bodyPattern: new RegExp(`(?:fee|charge|رسوم).*?${AMT}\\s*(?:${CUR})?`, 'i'),
    type: 'fee',
    bankName: 'Unknown',
    defaultCurrency: 'EGP',
  },
]
