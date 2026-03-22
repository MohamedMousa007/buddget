'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { EmptyState } from '@/components/ui/EmptyState'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/lib/hooks/useRequireAuthAction'
import { Pencil, Trash2 } from 'lucide-react'

export default function IncomePage() {
  const { incomeSources, deleteIncomeSource } = useFinanceStore(
    useShallow((s) => ({ incomeSources: s.incomeSources, deleteIncomeSource: s.deleteIncomeSource }))
  )
  const { setActiveModal, setEditingIncomeId } = useSettingsStore()
  const requireAuth = useRequireAuthAction()

  const openAddIncome = () =>
    requireAuth(
      () => setActiveModal('addIncome'),
      'Sign in or create an account to add income sources and sync your budget.'
    )

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Income</h1>
          <button
            type="button"
            onClick={openAddIncome}
            className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
          >
            + Add income
          </button>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-3">
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Recurring income is used for budget totals (including % of income mode). Edit amounts when your salary changes.
        </p>
        {incomeSources.length === 0 ? (
          <div className="glass-card rounded-2xl p-2">
            <EmptyState
              icon="💵"
              title="No income sources"
              description="Recurring sources power your budget and “% of income” category caps. Add salary, rent you receive, or other regular inflows."
              action={
                <button
                  type="button"
                  onClick={openAddIncome}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
                >
                  + Add income
                </button>
              }
            />
          </div>
        ) : (
          incomeSources.map((source) => (
            <div
              key={source.id}
              className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 group"
            >
              <div>
                <p className="text-sm font-medium text-white">{source.name}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">
                  {source.isRecurring ? `Recurring · day ${source.dayOfMonth ?? 1}` : 'One-time'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono-numbers text-white">
                  {formatCurrency(source.amount, source.currency)}/mo
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingIncomeId(source.id)
                    setActiveModal('editIncome')
                  }}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-brand-elevated)] opacity-70 group-hover:opacity-100"
                  aria-label="Edit"
                >
                  <Pencil className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this income source?')) deleteIncomeSource(source.id)
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-900/30 opacity-70 group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4 text-[var(--color-brand-red)]" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <QuickAddFAB />
    </div>
  )
}
