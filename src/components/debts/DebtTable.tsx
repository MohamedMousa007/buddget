'use client'

import { Trash2 } from 'lucide-react'
import { formatCurrency, formatDateShort } from '@/lib/utils/formatters'
import { goldGramsToMoney } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt, DebtPayment } from '@/lib/store/types'

interface DebtTableProps {
  debt: Debt
  payments: DebtPayment[]
}

export function DebtTable({ debt, payments }: DebtTableProps) {
  const { deleteDebtPayment, settings, goldPricePerGram, exchangeRates } = useFinanceStore()
  const base = settings.baseCurrency

  const paymentsWithBalance = [...payments]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce<{ items: (DebtPayment & { remainingAfter: number })[]; runningBalance: number }>(
      (acc, payment) => {
        const nextBalance = acc.runningBalance - payment.amountPaid
        acc.items.push({ ...payment, remainingAfter: nextBalance })
        return { items: acc.items, runningBalance: nextBalance }
      },
      { items: [], runningBalance: debt.startingBalance }
    ).items
    .reverse()

  if (paymentsWithBalance.length === 0) {
    return (
      <p className="text-sm text-[var(--color-brand-text-muted)] text-center py-4">
        No payments logged yet
      </p>
    )
  }

  const toBase = (debtUnitAmount: number) => {
    if (debt.isGold) return goldGramsToMoney(debtUnitAmount, goldPricePerGram, debt.goldKarat)
    return convertCurrency(debtUnitAmount, debt.currency, base, exchangeRates)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-brand-border)]">
            <th className="py-2 px-3 text-left text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">Date</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">Paid</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">Still to go</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">Notes</th>
            <th className="py-2 px-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {paymentsWithBalance.map((payment) => {
            const paidInBase = payment.amountInPrimary ?? toBase(payment.amountPaid)
            const hasOriginal = payment.originalAmount != null && payment.paymentCurrency && payment.paymentCurrency !== base

            return (
              <tr key={payment.id} className="border-b border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors group">
                <td className="py-2.5 px-3 text-sm font-mono-numbers text-[var(--color-brand-text-secondary)]">
                  {formatDateShort(payment.date)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {hasOriginal ? (
                    <>
                      <span className="text-sm font-mono-numbers text-[var(--color-brand-green)]">
                        {formatCurrency(payment.originalAmount!, payment.paymentCurrency!)}
                      </span>
                      <span className="block text-[10px] text-[var(--color-brand-text-muted)]">
                        {formatCurrency(paidInBase, base)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-mono-numbers text-[var(--color-brand-green)]">
                      {formatCurrency(paidInBase, base)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-sm font-mono-numbers text-white text-right">
                  {formatCurrency(toBase(Math.max(0, payment.remainingAfter)), base)}
                </td>
                <td className="py-2.5 px-3 text-sm text-[var(--color-brand-text-muted)] max-w-[200px] truncate">
                  {payment.notes || '–'}
                </td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this payment? This can\u2019t be undone.')) {
                        deleteDebtPayment(payment.id)
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--color-brand-red)]" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
