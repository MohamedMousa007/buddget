import type { FinanceStore, PaymentMethod, SavingsAccount } from '@/lib/store/types'
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
    || s.debts.some((d) => d.principalPaymentMethodId === id)
    || s.debts.some((d) => d.defaultPaymentMethodId === id)
    || s.debts.some((d) => d.linkedPaymentMethodId === id
      && (d.startingBalance > 0
        || s.debtPayments.some((p) => p.debtId === d.id)
        || s.recurringDebtPayments.some((r) => r.debtId === d.id)))
}

/** The method a closed or deleted default hands over to: open, never the Cash sentinel. */
export const getOpenDefaultCandidate = (methods: readonly PaymentMethod[], excludeId: string): PaymentMethod | undefined =>
  methods.find((m) => m.id !== excludeId && m.id !== DEFAULT_CASH_ID && !m.closedAt)

/** Money set aside in this account (I-14), read from the parts themselves: an untracked account has no balance row. */
export const holdsSetAside = (parts: readonly Pick<SavingsAccount, 'heldInPaymentMethodId' | 'currentBalance'>[], id: string): boolean =>
  parts.some((p) => p.heldInPaymentMethodId === id && p.currentBalance > 0)

/**
 * Removes a payment method the only safe way: referenced methods are closed (rows keep their owner), unreferenced
 * ones are deleted. Child cards are detached and the default always lands on an open method. Every changed row is
 * stamped so the sync tie-break keeps the edit. `'needs_answer'` (close or delete): money is still set aside in it and
 * "Where did this money go?" must be answered first (I-14); nothing changes.
 */
export function removePaymentMethod(
  state: Refs & Pick<FinanceStore, 'paymentMethods'>,
  id: string,
  mode: 'auto' | 'close' = 'auto',
): { paymentMethods: PaymentMethod[]; closed: boolean } | 'needs_answer' | null {
  const target = state.paymentMethods.find((m) => m.id === id)
  if (!target || target.type === 'cash') return null
  if (holdsSetAside(state.savingsAccounts, id)) return 'needs_answer'
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
