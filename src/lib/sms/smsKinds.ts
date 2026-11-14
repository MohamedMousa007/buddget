/**
 * The kinds a parsed SMS may carry. One list for the type and for the runtime checks, so a kind a model or a stored
 * template invents (a free string in a JSON column) cannot slip through as if it were known.
 */
export const SMS_EXPENSE_KINDS = [
  'purchase', 'online_purchase', 'atm_withdrawal',
  'instant_transfer_out', 'instant_transfer_in',
  'cc_payoff', 'installment_payment', 'own_transfer', 'currency_exchange',
  'income', 'refund', 'declined', 'fee', 'other',
] as const

export type KnownSmsKind = (typeof SMS_EXPENSE_KINDS)[number]

const KNOWN = new Set<string>(SMS_EXPENSE_KINDS)

export function isSmsExpenseKind(kind: unknown): kind is KnownSmsKind {
  return typeof kind === 'string' && KNOWN.has(kind)
}
