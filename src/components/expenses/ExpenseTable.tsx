'use client'

import { ExpenseRow } from './ExpenseRow'
import { formatCurrency } from '@/lib/utils/formatters'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Expense } from '@/lib/store/types'

interface ExpenseTableProps {
  expenses: Expense[]
  totalAmount: number
  currency: string
  onAddExpense: () => void
}

export function ExpenseTable({ expenses, totalAmount, currency, onAddExpense }: ExpenseTableProps) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="💸"
        title="No expenses this month"
        description="Add transactions to see them here, or change the month above if you expected older data."
        action={
          <button
            type="button"
            onClick={onAddExpense}
            className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
          >
            + Add expense
          </button>
        }
      />
    )
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-brand-border)]">
              <th className="py-3 px-4 text-left text-xs font-medium text-[var(--color-brand-text-muted)] uppercase tracking-wider">Date</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-[var(--color-brand-text-muted)] uppercase tracking-wider">Description</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-[var(--color-brand-text-muted)] uppercase tracking-wider">Category</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-[var(--color-brand-text-muted)] uppercase tracking-wider">Method</th>
              <th className="py-3 px-4 text-right text-xs font-medium text-[var(--color-brand-text-muted)] uppercase tracking-wider">Amount</th>
              <th className="py-3 px-4 text-right text-xs font-medium text-[var(--color-brand-text-muted)] uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2 px-4">
        {expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} isMobile />
        ))}
      </div>

      {/* Totals Footer */}
      <div className="sticky bottom-16 lg:bottom-0 bg-[var(--color-brand-card)]/95 backdrop-blur-xl border-t border-[var(--color-brand-border)] px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-[var(--color-brand-text-secondary)]">
          Showing {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
        </p>
        <p className="text-sm font-semibold font-mono-numbers text-white">
          Total: {formatCurrency(totalAmount, currency)}
        </p>
        <button
          onClick={onAddExpense}
          className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
        >
          + Add Expense
        </button>
      </div>
    </div>
  )
}
