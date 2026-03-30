import { useMemo } from 'react'
import type { Debt, DebtPayment } from '@/lib/store/types'

export type DebtPaymentHistoryRow = {
  debt: Debt
  payment: DebtPayment & { remainingAfter: number }
}

function paymentsWithRunningBalance(debt: Debt, payments: DebtPayment[]) {
  return [...payments]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce<{ items: (DebtPayment & { remainingAfter: number })[]; runningBalance: number }>(
      (acc, payment) => {
        const nextBalance = acc.runningBalance - payment.amountPaid
        acc.items.push({ ...payment, remainingAfter: nextBalance })
        return { items: acc.items, runningBalance: nextBalance }
      },
      { items: [], runningBalance: debt.startingBalance }
    ).items
}

/**
 * All debt payments with per-debt running balance and debt reference, newest-first.
 */
export function useDebtPaymentHistoryRows(
  debts: Debt[],
  debtPayments: DebtPayment[]
): DebtPaymentHistoryRow[] {
  return useMemo(() => {
    const byDebtId = new Map<string, DebtPayment[]>()
    for (const p of debtPayments) {
      const list = byDebtId.get(p.debtId)
      if (list) list.push(p)
      else byDebtId.set(p.debtId, [p])
    }

    const rows: DebtPaymentHistoryRow[] = []
    for (const debt of debts) {
      const payments = byDebtId.get(debt.id) ?? []
      for (const payment of paymentsWithRunningBalance(debt, payments)) {
        rows.push({ debt, payment })
      }
    }

    rows.sort(
      (a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime()
    )
    return rows
  }, [debts, debtPayments])
}
