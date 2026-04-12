'use client'

import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import type { Expense } from '@/lib/store/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/EmptyState'
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

interface RecentExpensesProps {
  expenses: Expense[]
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  const t = useT()
  const { groupByDate } = useLocalizedFormatters()
  const { deleteExpense, paymentMethods } = useFinanceStore(
    useShallow((s) => ({ deleteExpense: s.deleteExpense, paymentMethods: s.paymentMethods }))
  )
  const { setActiveModal, setEditingExpenseId } = useSettingsStore()
  const handleDelete = (expenseId: string) => {
    if (window.confirm(t.dashboard.confirmDeleteExpense)) {
      deleteExpense(expenseId)
    }
  }

  const handleEdit = (expenseId: string) => {
    setEditingExpenseId(expenseId)
    setActiveModal('editExpense')
  }


  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7)

  const grouped: Record<string, Expense[]> = {}
  for (const expense of recentExpenses) {
    const day = groupByDate(expense.date)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(expense)
  }

  const getMethodName = (id: string) => {
    return paymentMethods.find((m) => m.id === id)?.name || t.common.unknown
  }

  if (recentExpenses.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-2">
          {t.dashboard.recentTitle}
        </h3>
        <EmptyState
          icon="💸"
          title={t.dashboard.recentEmpty}
          description={t.dashboard.recentEmptyDesc}
          className="py-10"
        />
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.dashboard.recentTitle}
        </h3>
        <Link
          href="/expenses"
          className="text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)] transition-colors"
        >
          {t.dashboard.recentSeeAll}
        </Link>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([day, dayExpenses]) => (
          <div key={day}>
            <p className="text-xs font-medium text-[var(--color-brand-text-muted)] mb-2">
              {day}
            </p>
            <div className="space-y-1">
              {dayExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors group"
                >
                  <span className="text-base">
                    {CATEGORY_ICONS[expense.category] || '📦'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-brand-text-primary)] truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">
                      {expense.category}
                    </p>
                  </div>
                  <div className="text-end me-1">
                    <MoneyDisplay
                      amount={expense.amount}
                      currency={expense.currency}
                      variant="table"
                      primaryClassName="text-sm text-[var(--color-brand-text-primary)]"
                    />
                    <p className="text-xs text-[var(--color-brand-text-muted)]">
                      {getMethodName(expense.paymentMethodId)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-brand-border)]">
                      <MoreHorizontal className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-xs" onClick={() => handleEdit(expense.id)}>
                        <Pencil className="w-3 h-3 me-2" />
                        {t.common.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-xs text-[var(--color-brand-red)]"
                        onClick={() => handleDelete(expense.id)}
                      >
                        <Trash2 className="w-3 h-3 me-2" />
                        {t.common.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
