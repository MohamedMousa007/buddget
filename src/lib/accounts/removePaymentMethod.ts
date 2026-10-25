import type { FinanceStore, PaymentMethod } from '@/lib/store/types'
import { DEFAULT_CASH_ID, hasAccountHistory } from './kinds'

type Refs = Pick<
  FinanceStore,
  'expenses' | 'incomeEvents' | 'debts' | 'debtPayments' | 'savingsTransactions' | 'accountAdjustments' | 'recurringDebtPayments' | 'subscriptions' | 'incomeSources' | 'savingsAccounts'
>

/** Whether any row anywhere points at this method; removing such a method would hand its rows to Cash. */
export function isPaymentMethodReferenced(s: Refs, id: string): boolean {
  return hasAccountHistory(s, id)
    || s.recurringDebtPayments.some((r) => r.paymentMethodId === id)
    || s.subscriptions.some((x) => x.paymentMethodId === id)
    || s.incomeSources.some((x) => x.paymentMethodId === id)
    || s.savingsAccounts.some((a) => a.heldInPaymentMethodId === id)
    || s.debts.some((d) => d.linkedPaymentMethodId === id
      && (d.startingBalance > 0
        || s.debtPayments.some((p) => p.debtId === d.id)
        || s.recurringDebtPayments.some((r) => r.debtId === d.id)))
}

/** The method a closed or deleted default hands over to: open, never the Cash sentinel. */
export const getOpenDefaultCandidate = (methods: readonly PaymentMethod[], excludeId: string): PaymentMethod | undefined =>
  methods.find((m) => m.id !== excludeId && m.id !== DEFAULT_CASH_ID && !m.closedAt)

/**
 * Removes a payment method the only safe way: referenced methods are closed (rows keep their owner), unreferenced
 * ones are deleted. Child cards are detached and the default always lands on an open method. Every changed row is
 * stamped so the sync tie-break keeps the edit.
 */
export function removePaymentMethod(
  state: Refs & Pick<FinanceStore, 'paymentMethods'>,
  id: string,
  mode: 'auto' | 'close' = 'auto',
): { paymentMethods: PaymentMethod[]; closed: boolean } | null {
  const target = state.paymentMethods.find((m) => m.id === id)
  if (!target || target.type === 'cash') return null
  const now = new Date().toISOString()
  const closed = mode === 'close' || isPaymentMethodReferenced(state, id)
  const heir = target.isDefault ? getOpenDefaultCandidate(state.paymentMethods, id) : undefined
  const paymentMethods = state.paymentMethods.flatMap((m): PaymentMethod[] => {
    if (m.id === id) return closed ? [{ ...m, closedAt: now, isDefault: false, updatedAt: now }] : []
    const detach = m.parentId === id
    const promote = m.id === heir?.id
    return detach || promote ? [{ ...m, ...(detach ? { parentId: undefined } : {}), ...(promote ? { isDefault: true } : {}), updatedAt: now }] : [m]
  })
  return { paymentMethods, closed }
}
