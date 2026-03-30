'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import type { Expense } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

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
  const t = useT()
  const { formatDateShort } = useLocalizedFormatters()
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
    if (window.confirm(t.expenses.confirmDelete)) {
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
            {method?.name || t.common.unknown}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-end">
          <MoneyDisplay
            amount={expense.amount}
            currency={expense.currency}
            variant="table"
            primaryClassName="text-white"
          />
        </td>
        <td className="py-3 px-4 text-end">
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
          {formatDateShort(expense.date)} · {expense.category} · {method?.name || t.common.unknown}
        </p>
      </div>
      <div className="text-end">
        <MoneyDisplay
          amount={expense.amount}
          currency={expense.currency}
          variant="table"
          primaryClassName="text-sm text-white"
        />
      </div>
      <button
        onClick={handleEdit}
        className="p-1.5 rounded-lg hover:bg-[var(--color-brand-border)] transition-colors"
        aria-label={t.expenses.editPurchase}
      >
        <Pencil className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
      </button>
      <button
        onClick={handleDelete}
        className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors"
        aria-label={t.expenses.removePurchase}
      >
        <Trash2 className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
      </button>
    </div>
  )
}
