import type { BankPatternSet } from './types'

/**
 * Vodafone Cash — sender ID "VF-Cash".
 * Verified patterns from real device captures (money_tracking test fixtures).
 * Note the wallet's quirky date format HH:mm YY-MM-DD — not extracted (the
 * receive timestamp is used instead).
 */
export const VODAFONE_CASH_PATTERNS: BankPatternSet = {
  bank: 'Vodafone Cash',
  senderIds: ['VF-CASH', 'VFCASH', 'VODAFONECASH', 'VODAFONE CASH'],
  patterns: [
    {
      // "تم استلام مبلغ 6000 جنيه من رقم 01094490330 المسجل بإسم Mohamed S Amer
      //  على رقم محفظتك 01024193022. رصيدك الحالي: 6004.88 جنيه …"
      id: 'vfcash-receive-ar',
      regex: /تم\s+استلام\s+مبلغ\s+([\d,]+(?:\.\d+)?)\s*جني?[هة]\s+من\s+رقم\s+(\d{6,})\s+المسجل\s+ب[إا]سم\s+(.+?)(?:\s+على\s+رقم\s+محفظتك|\s+رصيدك)/,
      kind: 'instant_transfer_in',
      groups: { amount: 1, counterparty: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'wallet',
      verified: true,
    },
    {
      // "تم سحب 5900.00 جنية من محفظة فودافون كاش. رصيد حسابك الحالي 45.88 جنيه. …"
      id: 'vfcash-cashout-ar',
      regex: /تم\s+سحب\s+([\d,]+(?:\.\d+)?)\s*جني?[هة]\s+من\s+محفظة\s+فودافون\s+كاش/,
      kind: 'atm_withdrawal',
      groups: { amount: 1 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'wallet',
      verified: true,
    },
    {
      // "تم تحويل مبلغ 1500 جنيه لمحفظتك من رقم 01011111111 المسجل بإسم Sara …"
      id: 'vfcash-transfer-in-ar',
      regex: /تم\s+تحويل\s+مبلغ\s+([\d,]+(?:\.\d+)?)\s*جني?[هة]\s+لمحفظتك\s+من\s+رقم\s+(\d{6,})(?:\s+المسجل\s+ب[إا]سم\s+(.+?))?(?:\s+على|\s+رصيد|$)/,
      kind: 'instant_transfer_in',
      groups: { amount: 1, counterparty: 3 },
      currencyLiteral: 'EGP',
      paymentInstrument: 'wallet',
      verified: false,
    },
  ],
}
