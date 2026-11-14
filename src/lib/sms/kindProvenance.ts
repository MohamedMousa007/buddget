/**
 * A kind the AI or a learned template asserted, with nothing in the message to back it, must not take money out of
 * spending (S2c step 3, P1-7; docs/launch/S2c-invariants.md "Card repayment" and "Transfer or own-transfer kind with
 * kind_by_model only"). These are the pure decisions; dispatch applies them.
 */
import type { SmsExpenseKind } from './createSmsExpense'
import { detectLegDirection } from './directionGuard'
import { normalizeDigits } from './normalizeDigits'

export type RepaymentWording = 'paid_into_card' | 'card_as_instrument'

const MASK = String.raw`[*xX•#.\-]*`
const AR_REPAY = String.raw`(?:سداد|تسديد|سدد|دفع|مدفوع)`

/** "paid ... to/into your card", "credited to credit card": the card is where the money went. */
const PAID_INTO_CARD = [
  /\b(?:paid|payment|credited)\b[\s\S]{0,60}?\b(?:to|into)\b\s+(?:your\s+)?(?:credit\s+)?card\b/i,
  new RegExp(String.raw`${AR_REPAY}(?:\s+\S+){0,4}?\s+(?:في|فى|إلى|الى|ل)\s*(?:ال)?بطاق`),
]

/** "payment of ... via card ...": the card is the means of paying, so this is a purchase made with the card. */
const CARD_AS_INSTRUMENT = [
  /\b(?:paid|payment|paying)\b[\s\S]{0,60}?\bvia\s+(?:your\s+)?(?:(?:credit|debit)\s+)?card\b/i,
  new RegExp(String.raw`${AR_REPAY}[\s\S]{0,60}?عبر\s*${MASK}\s*\d{3,4}(?!\d)`),
]

/**
 * How a repayment-typed message words the card: as the place the money went, as the instrument that paid, or neither.
 * "Into the card" wins when both appear, because it names where the money went.
 */
export function repaymentWording(body: string): RepaymentWording | null {
  const text = normalizeDigits(body)
  if (PAID_INTO_CARD.some((re) => re.test(text))) return 'paid_into_card'
  if (CARD_AS_INSTRUMENT.some((re) => re.test(text))) return 'card_as_instrument'
  return null
}

/**
 * The plain kind of a model-asserted repayment: spending when the wording makes the card the instrument, otherwise null
 * (the repayment path is unchanged, whether or not a debt is registered).
 */
export function plainKindForModelRepayment(body: string): SmsExpenseKind | null {
  return repaymentWording(body) === 'card_as_instrument' ? 'purchase' : null
}

/**
 * The plain kind of an own transfer only the model asserted, taken from the direction the message itself shows: a
 * credit is a transfer in, anything else a transfer out. A transfer out is the safe default (it counts as spending).
 */
export function plainKindForModelOwnTransfer(body: string): 'instant_transfer_in' | 'instant_transfer_out' {
  return detectLegDirection(normalizeDigits(body)) === 'credit' ? 'instant_transfer_in' : 'instant_transfer_out'
}
