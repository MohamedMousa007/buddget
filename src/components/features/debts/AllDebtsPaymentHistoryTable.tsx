'use client'

import { Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import type { DebtPaymentHistoryRow } from '@/hooks/useDebtPaymentHistoryRows'
import type { Debt } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'

type DebtsCopy = Dictionary['debts']

interface AllDebtsPaymentHistoryTableProps {
  rows: DebtPaymentHistoryRow[]
  baseCurrency: string
  formatDateShort: (iso: string) => string
  toBase: (debt: Debt, debtUnitAmount: number) => number
  deleteDebtPayment: (id: string) => void
  t: DebtsCopy
}

/** Table body for unified debt payment history (newest first). */
export function AllDebtsPaymentHistoryTable({
  rows,
  baseCurrency,
  formatDateShort,
  toBase,
  deleteDebtPayment,
  t,
}: AllDebtsPaymentHistoryTableProps) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[min(100%,640px)]">
        <thead>
          <tr className="border-b border-[var(--color-brand-border)]">
            <th className="py-2 px-2 sm:px-3 text-start text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">
              {t.colBalance}
            </th>
            <th className="py-2 px-2 sm:px-3 text-start text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">
              {t.colDate}
            </th>
            <th className="py-2 px-2 sm:px-3 text-end text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">
              {t.colPaid}
            </th>
            <th className="py-2 px-2 sm:px-3 text-end text-xs font-medium text-[var(--color-brand-text-muted)] uppercase">
              {t.colStillToGo}
            </th>
            <th className="py-2 px-2 sm:px-3 text-start text-xs font-medium text-[var(--color-brand-text-muted)] uppercase hidden md:table-cell">
              {t.colNotes}
            </th>
            <th className="py-2 px-2 w-10" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ debt, payment }) => {
            const paidInBase = payment.amountInPrimary ?? toBase(debt, payment.amountPaid)
            const hasOriginal =
              payment.originalAmount != null &&
              payment.paymentCurrency &&
              payment.paymentCurrency !== baseCurrency

            return (
              <tr
                key={payment.id}
                className="border-b border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors group"
              >
                <td className="py-2.5 px-2 sm:px-3 text-sm font-semibold text-[var(--color-brand-text-primary)] uppercase max-w-[120px] sm:max-w-[160px] truncate">
                  {debt.name}
                </td>
                <td className="py-2.5 px-2 sm:px-3 text-sm font-mono-numbers text-[var(--color-brand-text-secondary)] whitespace-nowrap">
                  {formatDateShort(payment.date)}
                </td>
                <td className="py-2.5 px-2 sm:px-3 text-end">
                  {hasOriginal ? (
                    <>
                      <span className="text-sm font-mono-numbers text-[var(--color-brand-green)]">
                        {formatCurrency(payment.originalAmount!, payment.paymentCurrency!)}
                      </span>
                      <span className="block text-[10px] text-[var(--color-brand-text-muted)]">
                        {formatCurrency(paidInBase, baseCurrency)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-mono-numbers text-[var(--color-brand-green)]">
                      {formatCurrency(paidInBase, baseCurrency)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-2 sm:px-3 text-sm font-mono-numbers text-[var(--color-brand-text-primary)] text-end whitespace-nowrap">
                  {formatCurrency(toBase(debt, Math.max(0, payment.remainingAfter)), baseCurrency)}
                </td>
                <td className="py-2.5 px-2 sm:px-3 text-sm text-[var(--color-brand-text-muted)] max-w-[200px] truncate hidden md:table-cell">
                  {payment.notes || '–'}
                </td>
                <td className="py-2.5 px-2 sm:px-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t.confirmDeletePayment)) {
                        deleteDebtPayment(payment.id)
                      }
                    }}
                    className="md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity p-1 rounded hover:bg-red-900/30"
                    aria-label={t.deletePaymentAria}
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
