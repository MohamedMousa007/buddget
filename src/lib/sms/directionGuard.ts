/**
 * Deterministic direction guard — the last word on whether money came IN or went OUT.
 *
 * Every parse tier (curated regex, learned template, AI) can get the direction wrong, and
 * the AI tier reliably does when the wording fights the ledger. HSBC prints an INBOUND wire
 * as "20JUL26 TT Payment to 103-104***-110 USD 3,097.24+": "Payment to" reads as an outgoing
 * payment to any model, but the account named is the one being CREDITED and the trailing "+"
 * says so. A 3,097 USD salary was booked as a Remittance expense on exactly that reading.
 *
 * The trailing +/- is the bank's own ledger sign. It is mechanical, never editorialised, and
 * present on every message in the statement family — so it outranks whatever the tier guessed.
 *
 * ponytail: sign only, no verb signal. "credited"/"debited" invert on reversals ("was reversed
 * with IPN outward transfer ... from X" is a refund, i.e. a credit), and the verb-bearing
 * templates are already covered by curated patterns. The sign never lies.
 *
 * Applied in `dispatch`, so /api/sms/parse and /api/sms/confirm are both covered — including
 * senders nobody has curated a template for yet.
 */
import type { SmsExpenseKind } from './createSmsExpense'

export type MoneyDirection = 'credit' | 'debit'

/**
 * Bank-statement ledger sign: "USD 3,097.24+" (credit) / "EGP 715.00-" (debit).
 *
 * Anchored on a currency code and allowing no space before the sign, so a date
 * ("20-07-2026"), a masked account ("103-104***-110") or a hyphenated reference can
 * never be read as a debit marker.
 */
const SIGNED_AMOUNT = /(?:EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP)\s*[\d,]+(?:\.\d+)?([+-])(?=\s|$)/gi

/** Kinds that mean money arrived. */
const CREDIT_KINDS = new Set<string>(['income', 'instant_transfer_in', 'refund'])

/** Kinds that mean money left. */
const DEBIT_KINDS = new Set<string>([
  'purchase',
  'online_purchase',
  'atm_withdrawal',
  'instant_transfer_out',
  'cc_payoff',
  'installment_payment',
  'fee',
])

// own_transfer / currency_exchange / declined / other are deliberately in neither set: they
// describe a two-leg move (each leg carries its own sign) or no money movement at all, so the
// sign confirms nothing about the classification and must not perturb it.

/**
 * The ledger sign the message carries, or null when it carries none — or carries both,
 * which means the message is not the single-transaction statement form this reads.
 */
export function detectLedgerSign(body: string): MoneyDirection | null {
  const signs = new Set<string>()
  for (const m of body.matchAll(SIGNED_AMOUNT)) signs.add(m[1])
  if (signs.size !== 1) return null
  return signs.has('+') ? 'credit' : 'debit'
}

/**
 * Returns the kind corrected against the ledger sign, or the kind unchanged when the message
 * carries no sign or the two already agree.
 *
 * A contradicted kind becomes the neutral transfer of the proven direction rather than a
 * guess at its nature: `instant_transfer_in` still reaches the salary matcher and the income
 * ledger, `instant_transfer_out` still counts as spend. Naming it `income` or `purchase`
 * outright would invent a story the SMS never told.
 */
export function guardDirection(kind: SmsExpenseKind, body: string): SmsExpenseKind {
  const dir = detectLedgerSign(body)
  if (!dir) return kind
  const k = kind ?? ''
  if (dir === 'credit' && DEBIT_KINDS.has(k)) return 'instant_transfer_in'
  if (dir === 'debit' && CREDIT_KINDS.has(k)) return 'instant_transfer_out'
  return kind
}
