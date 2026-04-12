'use client'

import { useState } from 'react'
import { ArrowRight, Check, Pencil, RefreshCcw } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import { BuddgyLoadingState } from '@/components/features/budget-planner/BuddgyLoadingState'
import { BuddgyRegenerateFeedback } from '@/components/features/budget-planner/BuddgyRegenerateFeedback'
import type { RegenerateTweak } from '@/lib/budget/buddgyBuilderRedistribution'
import { formatCurrency } from '@/lib/utils/formatters'

const REGEN_MESSAGES = ['Rethinking your plan…', 'Adjusting categories…', 'Almost ready…']
const PLAN_MESSAGES = ['Finalizing your plan…', 'Polishing numbers…', 'Almost there…']

/**
 * Plan preview: income, expenses, projected savings; edit amounts, regenerate (AI), confirm.
 */
export function BuddgyStepPlan({ flow }: { flow: BuddgyBuilderApi }) {
  const {
    basics,
    displayExpenseRows,
    totalPlannedExpenses,
    projectedSavings,
    loading,
    loadingKind,
    error,
    confirmAndApplyPlan,
    regenCount,
    regeneratePlan,
    rentAdjustHint,
    editingAmounts,
    beginAmountEdits,
    clearAmountEdits,
    setRowAmount,
  } = flow

  const [regenOpen, setRegenOpen] = useState(false)

  const overIncome = projectedSavings < 0
  const shortfall = overIncome ? Math.abs(projectedSavings) : 0
  const savingsRate =
    basics.income > 0 ? Math.round((Math.max(0, projectedSavings) / basics.income) * 100) : 0

  if (loading && loadingKind === 'regen') {
    return <BuddgyLoadingState messages={REGEN_MESSAGES} intervalMs={2000} />
  }

  if (loading && loadingKind === 'plan') {
    return <BuddgyLoadingState messages={PLAN_MESSAGES} intervalMs={2000} />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            Total income (est.)
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {formatCurrency(basics.income, basics.currency, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            Total planned expenses
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {formatCurrency(totalPlannedExpenses, basics.currency, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            Projected savings
          </p>
          <p
            className={`mt-1 font-mono text-sm font-semibold ${
              projectedSavings >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'
            }`}
          >
            {formatCurrency(projectedSavings, basics.currency, true)}
          </p>
        </div>
      </div>

      {basics.income > 0 && (
        <p className="text-xs text-[var(--color-brand-text-secondary)]">
          If you stick to this plan, you&apos;ll save {formatCurrency(Math.max(0, projectedSavings), basics.currency, true)}{' '}
          this month ({savingsRate}% of income).
        </p>
      )}

      {overIncome && (
        <p className="text-xs font-medium text-[var(--color-brand-red)]">
          Expenses exceed your income by {formatCurrency(shortfall, basics.currency, true)}.
        </p>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          Categories
        </p>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2">
          {displayExpenseRows.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate text-[var(--color-brand-text-primary)]">
                {cat.emoji} {cat.name}
              </span>
              {editingAmounts ?
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Math.round(cat.amount)}
                  onChange={(e) => setRowAmount(cat.name, Number(e.target.value) || 0)}
                  className="w-24 shrink-0 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 py-1 text-right font-mono text-xs text-[var(--color-brand-text-primary)]"
                />
              : <span className="shrink-0 font-mono text-[var(--color-brand-text-secondary)]">
                  {cat.amount.toLocaleString()}
                </span>
              }
            </div>
          ))}
        </div>
      </div>

      {rentAdjustHint ?
        <p className="text-xs text-[var(--color-brand-amber)]">{rentAdjustHint}</p>
      : null}

      {regenOpen ?
        <BuddgyRegenerateFeedback
          disabled={regenCount >= 3}
          loading={loading}
          onCancel={() => setRegenOpen(false)}
          onRegenerate={(tweak: RegenerateTweak, note) => {
            setRegenOpen(false)
            void regeneratePlan(tweak, note)
          }}
        />
      : null}

      {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => {
            if (editingAmounts) clearAmountEdits()
            else beginAmountEdits()
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-xs font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editingAmounts ? 'Done editing' : 'Edit amounts'}
        </button>

        <button
          type="button"
          onClick={() => setRegenOpen((o) => !o)}
          disabled={regenCount >= 3 || loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-xs font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-40 transition-colors"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Regenerate{regenCount > 0 ? ` (${regenCount}/3)` : ''}
        </button>

        <button
          type="button"
          onClick={() => void confirmAndApplyPlan()}
          disabled={loading || displayExpenseRows.length === 0 || basics.income <= 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="h-4 w-4" />
          Confirm plan
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
