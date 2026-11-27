import type { PaymentMethod, PaymentMethodType } from '@/lib/store/types'

import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

export { DEFAULT_CASH_ID }

/** Types that hold a balance of their own (stored value included). */
const HOLDERS: ReadonlySet<PaymentMethodType> = new Set(['cash', 'bank_account', 'wallet', 'prepaid_card'])
/** Types a card can hang under. Cash and prepaid cards hold money but nothing hangs under them. */
const PARENTS: ReadonlySet<PaymentMethodType> = new Set(['bank_account', 'wallet'])

export const holdsBalance = (type: PaymentMethodType): boolean => HOLDERS.has(type)
export const canBeParent = (type: PaymentMethodType): boolean => PARENTS.has(type)
/** Debit cards spend straight out of their parent account. */
export const drawsOnParent = (type: PaymentMethodType): boolean => type === 'debit_card'

/**
 * Methods a form may offer: closed accounts leave the lists, and the in-store cash sentinel hides once a real
 * Cash account exists (two "Cash" entries would be ambiguous). The currently selected one always stays.
 */
export function pickablePaymentMethods(methods: readonly PaymentMethod[], keepId?: string): PaymentMethod[] {
  const realCash = methods.some((m) => m.type === 'cash' && m.id !== DEFAULT_CASH_ID && !m.closedAt)
  return methods.filter((m) => m.id === keepId || (!m.closedAt && !(realCash && m.id === DEFAULT_CASH_ID)))
}

/** Methods a filter may offer: closed ones stay (old rows still carry them); the cash sentinel hides once a real Cash exists. */
export function filterablePaymentMethods(methods: readonly PaymentMethod[]): PaymentMethod[] {
  const realCash = methods.some((m) => m.type === 'cash' && m.id !== DEFAULT_CASH_ID && !m.closedAt)
  return methods.filter((m) => !(realCash && m.id === DEFAULT_CASH_ID))
}

/** A provisional account (created from a bank message, not yet confirmed) never carries a balance or reaches net worth. */
export const isTracked = (pm: PaymentMethod): boolean =>
  holdsBalance(pm.type) && pm.openingBalance != null && pm.openingAt != null && !pm.provisional

/** I-11: an account whose balance is known and still in the user's totals. Undefined = deleted (gone from the list). */
export const isLiveAccount = (pm: PaymentMethod | undefined): pm is PaymentMethod => !!pm && isTracked(pm) && !pm.closedAt

/** I-11: an account that may hold set-aside parts: live and counted. One rule for every writer. */
export const canHoldParts = (pm: PaymentMethod | undefined): pm is PaymentMethod => isLiveAccount(pm) && !pm.excluded

/** Live (not closed) balance holders, the rows of the Accounts list. */
/** The in-store cash sentinel is a stand-in for the Cash account, never an account row of its own. */
/** A provisional account waits in the detected-accounts sheet for the user's answer before it joins the list. */
export const isOpenAccount = (pm: PaymentMethod): boolean => holdsBalance(pm.type) && !pm.closedAt && pm.id !== DEFAULT_CASH_ID && !pm.provisional

/** An account the user has set up: every open account except a Cash with no balance tracked (every user has one). */
export const isSetUpAccount = (pm: PaymentMethod): boolean => isOpenAccount(pm) && (pm.type !== 'cash' || isTracked(pm))

/** Whether any ledger row points at this account. */
export function hasAccountHistory(
  s: { expenses: readonly { paymentMethodId?: string; toPaymentMethodId?: string }[]; incomeEvents: readonly { paymentMethodId?: string }[]; debtPayments: readonly { paymentMethodId?: string }[]; savingsTransactions: readonly { paymentMethodId?: string }[]; accountAdjustments: readonly { paymentMethodId: string }[] },
  id: string,
): boolean {
  return s.expenses.some((e) => e.paymentMethodId === id || e.toPaymentMethodId === id)
    || s.incomeEvents.some((e) => e.paymentMethodId === id)
    || s.debtPayments.some((p) => p.paymentMethodId === id)
    || s.savingsTransactions.some((t) => t.paymentMethodId === id)
    || s.accountAdjustments.some((a) => a.paymentMethodId === id)
}
