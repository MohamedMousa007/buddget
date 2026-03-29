'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { formatDateShort } from '@/lib/utils/formatters'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import type { Expense } from '@/lib/store/types'

const CATEGORY_ICONS: Record<string, string> = {
  Rent: '🏠',
  Transport: '🚇',
  Food: '🍕',
  Enjoyment: '🎮',
  Savings: '💰',
  Debt: '💳',
  Remittance: '💸',
  Other: '📦',
}

interface ExpenseRowProps {
  expense: Expense
  isMobile?: boolean
}

export function ExpenseRow({ expense, isMobile = false }: ExpenseRowProps) {
  const { deleteExpense, paymentMethods } = useFinanceStore(
    useShallow((s) => ({ deleteExpense: s.deleteExpense, paymentMethods: s.paymentMethods }))
  )
  const { setActiveModal, setEditingExpenseId } = useSettingsStore()
  const method = paymentMethods.find((m) => m.id === expense.paymentMethodId)
  const handleEdit = () => {
    setEditingExpenseId(expense.id)
    setActiveModal('editExpense')
  }
  const handleDelete = () => {
    if (window.confirm('Remove this transaction? This will be gone for good.')) {
      deleteExpense(expense.id)
    }
  }

  if (!isMobile) {
    return (
      <tr className="border-b border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors group">
        <td className="py-3 px-4 text-sm text-[var(--color-brand-text-secondary)] font-mono-numbers">
          {formatDateShort(expense.date)}
        </td>
        <td className="py-3 px-4 text-sm text-white">
          {expense.description}
        </td>
        <td className="py-3 px-4 text-sm">
          <span className="flex items-center gap-1.5 text-[var(--color-brand-text-secondary)]">
            <span>{CATEGORY_ICONS[expense.category]}</span>
            {expense.category}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-[var(--color-brand-text-secondary)]">
          <span className="flex items-center gap-1.5">
            {method && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: method.color || '#fff' }}
              />
            )}
            {method?.name || 'Unknown'}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-right">
          <MoneyDisplay
            amount={expense.amount}
            currency={expense.currency}
            amountInPrimary={expense.amountInBaseCurrency}
            variant="table"
            primaryClassName="text-white"
          />
        </td>
        <td className="py-3 px-4 text-right">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg hover:bg-[var(--color-brand-border)] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)]" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-[var(--color-brand-red)]" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="glass-card rounded-xl p-3 flex items-center gap-3">
      <span className="text-lg">{CATEGORY_ICONS[expense.category]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{expense.description}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          {formatDateShort(expense.date)} · {expense.category} · {method?.name || 'Unknown'}
        </p>
      </div>
      <div className="text-right">
        <MoneyDisplay
          amount={expense.amount}
          currency={expense.currency}
          amountInPrimary={expense.amountInBaseCurrency}
          variant="table"
          primaryClassName="text-sm text-white"
        />
      </div>
      <button
        onClick={handleEdit}
        className="p-1.5 rounded-lg hover:bg-[var(--color-brand-border)] transition-colors"
        aria-label="Edit purchase"
      >
        <Pencil className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
      </button>
      <button
        onClick={handleDelete}
        className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors"
        aria-label="Remove purchase"
      >
        <Trash2 className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
      </button>
    </div>
  )
}
