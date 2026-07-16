import type { BankPatternSet } from './types'

/**
 * QNB Alahli Egypt — sender ID "QNB EGYPT", hotline 16607. The body never names
 * the bank, so the sender ID is the only institution signal (see
 * docs/SMS_PATTERN_RESEARCH.md).
 *
 * Egypt-qualified sender IDs only: bare "QNB" is Qatar National Bank (a
 * separate `qnb` brand in the catalogue), and claiming it here would label a
 * Qatari SMS as QNB Alahli. Sender IDs only order the match pass, so leaving it
 * out costs nothing — a genuine QNB Egypt body still matches on the fallback.
 */
export const QNB_PATTERNS: BankPatternSet = {
  bank: 'QNB Alahli',
  senderIds: ['QNB EGYPT', 'QNBEGYPT', 'QNB ALAHLI', 'QNBALAHLI'],
  patterns: [
    {
      // "Your Debit Card **6831 had a Successful transaction of EGP 1884.50
      //  @EL SALAM SHOPPING CE,your available bal.EGP160.17 for lost/stolen
      //  card call 16607"
      id: 'qnb-card-trx-en',
      regex: /Your\s+(?:Debit|Credit)\s+Card\s+\*+(\d{4})\s+had\s+a\s+Successful\s+transaction\s+of\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s*@\s*(.+?)\s*,\s*your\s+available\s+bal/i,
      kind: 'purchase',
      groups: { last4: 1, currency: 2, amount: 3, counterparty: 4 },
      paymentInstrument: 'card',
      verified: true,
    },
  ],
}
