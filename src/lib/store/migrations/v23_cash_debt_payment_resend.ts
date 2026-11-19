import type { DebtPayment, Expense, PaymentMethod } from '@/lib/store/types'
import { cashAccountId } from '@/lib/accounts/resolve'
import { DEFAULT_CASH_ID } from './v17_uuid_remap'

/**
 * v23 (QA-15/50): debt payments saved with the in-store Cash sentinel (or an empty method) were refused by the server
 * and later recorded as delivered. Give them the real Cash account (or no method when none exists) and a fresh edit
 * time, with their linked expenses, so they no longer match the stored fingerprint and the next flush sends them.
 */
export function resendCashDebtPayments(base: Record<string, unknown>, nowIso: string): void {
  if (!Array.isArray(base.debtPayments)) return
  const methods = Array.isArray(base.paymentMethods) ? (base.paymentMethods as PaymentMethod[]) : []
  const cash = cashAccountId(methods)
  const realCash = cash && cash !== DEFAULT_CASH_ID ? cash : undefined
  const resent = new Set<string>()
  base.debtPayments = (base.debtPayments as DebtPayment[]).map((p) => {
    if (p.paymentMethodId !== DEFAULT_CASH_ID && p.paymentMethodId !== '') return p
    resent.add(p.id)
    return { ...p, paymentMethodId: realCash, updatedAt: nowIso }
  })
  if (resent.size === 0 || !Array.isArray(base.expenses)) return
  base.expenses = (base.expenses as Expense[]).map((e) => (e.linkedDebtPaymentId && resent.has(e.linkedDebtPaymentId) ? { ...e, updatedAt: nowIso } : e))
}
