'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { Pencil, Trash2, Wallet } from 'lucide-react'
import type { IncomeSource } from '@/lib/store/types'
import { incomeMonthlyMultiplier } from '@/lib/utils/calculations'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'

function recurringSubtitle(source: IncomeSource, inc: Dictionary['income']): string {
  if (!source.isRecurring) return inc.oneTime
  const f = source.recurringFrequency ?? 'monthly'
  if (f === 'monthly') return inc.recurringMonthly(source.dayOfMonth ?? 1)
  if (f === 'biweekly') return inc.recurringBiweekly
  return inc.recurringWeekly
}

function amountLine(source: IncomeSource, inc: Dictionary['income']): string {
  const amt = formatCurrency(source.amount, source.currency)
  if (!source.isRecurring) return amt
  const f = source.recurringFrequency ?? 'monthly'
  if (f === 'monthly') return inc.perMonth(amt)
  if (f === 'biweekly') return inc.perPaycheck(amt)
  return inc.perWeek(amt)
}

function monthlyEquivNote(source: IncomeSource, inc: Dictionary['income']): string | null {
  if (!source.isRecurring) return null
  const m = incomeMonthlyMultiplier(source.recurringFrequency)
  if (m === 1) return null
  const eq = source.amount * m
  return inc.monthlyEquiv(formatCurrency(eq, source.currency))
}

export default function IncomePage() {
  const { incomeSources, deleteIncomeSource } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      deleteIncomeSource: s.deleteIncomeSource,
    }))
  )
  const { setActiveModal, setEditingIncomeId } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()

  const openAddIncome = () =>
    requireAuth(
      () => setActiveModal('addIncome'),
      t.income.requireAuth
    )

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.income.pageTitle}
          </h1>
          <button
            type="button"
            onClick={openAddIncome}
            className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
          >
            {t.income.addSource}
          </button>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-3">
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          {t.income.helperText}
        </p>
        {incomeSources.length === 0 ? (
          <div className="glass-card rounded-2xl p-2">
            <EmptyState
              icon={t.income.emptyIcon}
              title={t.income.emptyTitle}
              description={t.income.emptyDesc}
              action={
                <button
                  type="button"
                  onClick={openAddIncome}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
                >
                  {t.income.emptyButton}
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
                <p className="text-xs text-[var(--color-brand-text-muted)]">{recurringSubtitle(source, t.income)}</p>
                {monthlyEquivNote(source, t.income) ? (
                  <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5">
                    {monthlyEquivNote(source, t.income)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono-numbers text-white">{amountLine(source, t.income)}</span>
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
                    if (window.confirm(t.income.confirmDelete)) deleteIncomeSource(source.id)
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
    </div>
  )
}
