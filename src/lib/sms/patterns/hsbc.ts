import type { BankPatternSet } from './types'

/**
 * HSBC Egypt — sender ID "HSBC".
 * All patterns verified against real captured SMS (sms_parse_log, June 2026).
 */
export const HSBC_PATTERNS: BankPatternSet = {
  bank: 'HSBC',
  senderIds: ['HSBC', 'HSBCEGYPT', 'HSBC EGYPT'],
  patterns: [
    {
      // "Your HSBC Account ********0001 was debited with IPN outward transfer
      //  for EGP 3.50 on 10-06-2026 02:16 to SALMA SAMY ELSAYED with reference 3f5b5478."
      id: 'hsbc-ipn-out',
      regex: /Account\s+\*+(\d{4})\s+was\s+debited\s+with\s+IPN\s+(?:outward\s+)?transfer\s+for\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+on\s+(\d{2}-\d{2}-\d{4}(?:\s+\d{2}:\d{2})?)\s+to\s+(.+?)\s+with\s+reference/i,
      kind: 'instant_transfer_out',
      groups: { last4: 1, currency: 2, amount: 3, datetime: 4, counterparty: 5 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "Your HSBC Account ********0001 was credited with IPN inward transfer
      //  for EGP 2.00 on 08-06-2026 01:01 from KARIM HAZEM with reference 6d158f5b."
      id: 'hsbc-ipn-in',
      regex: /Account\s+\*+(\d{4})\s+was\s+credited\s+with\s+IPN\s+(?:inward\s+)?transfer\s+for\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+on\s+(\d{2}-\d{2}-\d{4}(?:\s+\d{2}:\d{2})?)\s+from\s+(.+?)\s+with\s+reference/i,
      kind: 'instant_transfer_in',
      groups: { last4: 1, currency: 2, amount: 3, datetime: 4, counterparty: 5 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "Your HSBC Account ****0001 was debited EGP 250.00 for purchase at
      //  Carrefour Egypt on 09-06-2026"
      id: 'hsbc-account-purchase',
      regex: /Account\s+\*+(\d{4})\s+was\s+debited\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+for\s+purchase\s+at\s+(.+?)\s+on\s+(\d{2}-\d{2}-\d{4}(?:\s+\d{2}:\d{2})?)/i,
      kind: 'purchase',
      groups: { last4: 1, currency: 2, amount: 3, counterparty: 4, datetime: 5 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "Your Credit Card ending with * 1234 has been used for EGP 1339.50
      //  on 27/05/2026 at WE-FBB-Pre. Your available limit is EGP 100.00"
      id: 'hsbc-cc-purchase',
      regex: /Credit\s+Card\s+ending\s+with\s+\*+\s*(\d{1,4})\s+has\s+been\s+used\s+for\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\s+on\s+(\d{2}\/\d{2}\/\d{2,4})\s+at\s+(.+?)(?:\.|$)/i,
      kind: 'purchase',
      groups: { last4: 1, currency: 2, amount: 3, datetime: 4, counterparty: 5 },
      paymentInstrument: 'card',
      verified: true,
    },
    {
      // ATM withdrawal variant of the account-debit structure.
      id: 'hsbc-atm-withdrawal',
      regex: /Account\s+\*+(\d{4})\s+was\s+debited(?:\s+with)?\s+(?:an?\s+)?ATM\s+(?:cash\s+)?withdrawal\s+(?:of|for)\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)/i,
      kind: 'atm_withdrawal',
      groups: { last4: 1, currency: 2, amount: 3 },
      paymentInstrument: 'account',
      verified: false,
    },
    {
      // "20JUN26 Phone Banking Transfer to 103-104***-001 EGP 9,968.00+ Your available balance is EGP 11,349.68"
      // '+' suffix = credit leg of own-account FX (USD→EGP). Paired by dispatch with the 'from' debit leg.
      id: 'hsbc-phone-banking-fx-credit',
      regex: /(\d{1,2}[A-Z]{3}\d{2,4})\s+Phone\s+Banking\s+Transfer\s+to\s+([\d\-*]+)\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\+/i,
      kind: 'currency_exchange',
      groups: { datetime: 1, counterparty: 2, currency: 3, amount: 4 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "20JUN26 Phone Banking Transfer from 103-104***-110 USD 200.00- Your available balance is USD 2,172.73"
      // '-' suffix = debit leg of own-account FX. Paired by dispatch with the 'to' credit leg.
      id: 'hsbc-phone-banking-fx-debit',
      regex: /(\d{1,2}[A-Z]{3}\d{2,4})\s+Phone\s+Banking\s+Transfer\s+from\s+([\d\-*]+)\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)-/i,
      kind: 'currency_exchange',
      groups: { datetime: 1, counterparty: 2, currency: 3, amount: 4 },
      paymentInstrument: 'account',
      verified: true,
    },
    {
      // "13JUN26 Phone Banking Transfer to 103-104***-001 EGP 30,000.48+
      //  Your available balance is EGP 36,183.18"
      // Fallback for transfers without +/- sign (plain outgoing transfers to own accounts).
      id: 'hsbc-phone-banking-transfer-out',
      regex: /(\d{1,2}[A-Z]{3}\d{2,4})\s+Phone\s+Banking\s+Transfer\s+to\s+([\d\-*]+)\s+([A-Z]{3})\s+([\d,]+(?:\.\d+)?)\+?/i,
      kind: 'instant_transfer_out',
      groups: { datetime: 1, counterparty: 2, currency: 3, amount: 4 },
      paymentInstrument: 'account',
      verified: true,
    },
  ],
}
