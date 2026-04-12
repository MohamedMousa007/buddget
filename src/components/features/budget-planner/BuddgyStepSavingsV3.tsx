'use client'

import { useState } from 'react'
import { ArrowRight, RefreshCcw } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import { BuddgyLoadingState } from '@/components/features/budget-planner/BuddgyLoadingState'
import { BuddgyRegenerateFeedback } from '@/components/features/budget-planner/BuddgyRegenerateFeedback'
import type { RegenerateTweak } from '@/lib/budget/buddgyBuilderRedistribution'

const PRESETS: { label: string; percent: number }[] = [
  { label: 'Maximum', percent: 100 },
  { label: 'Balanced', percent: 70 },
  { label: 'Custom', percent: -1 },
]

const PLAN_MESSAGES = ['Building your plan…', 'Optimizing categories…', 'Almost there…']

/**
 * Step 3: Live expense preview + savings slider + confirm (applies plan in one step).
 */
export function BuddgyStepSavingsV3({ flow }: { flow: BuddgyBuilderApi }) {
  const {
    savingsPercent,
    setSavingsPercent,
    savingsAmount,
    basics,
    displayExpenseRows,
    totalPlannedExpenses,
    remainingPool,
    loading,
    loadingKind,
    error,
    confirmAndApplyPlan,
    regenCount,
    submitRegenerateFeedback,
    rentAdjustHint,
  } = flow

  const [regenOpen, setRegenOpen] = useState(false)

  const activePreset = savingsPercent === 100 ? 'Maximum' : savingsPercent === 70 ? 'Balanced' : 'Custom'
  const savingsRate = basics.income > 0 ? Math.round((savingsAmount / basics.income) * 100) : 0

  if (loading && loadingKind === 'plan') {
    return <BuddgyLoadingState title="Finalizing your plan…" messages={PLAN_MESSAGES} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          Your expenses
        </p>
        <p className="text-sm font-mono font-semibold text-[var(--color-brand-text-primary)]">
          {basics.currency} {totalPlannedExpenses.toLocaleString()}
        </p>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2">
        {displayExpenseRows.map((cat) => (
          <div key={cat.name} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="text-[var(--color-brand-text-primary)] truncate">
              {cat.emoji} {cat.name}
            </span>
            <span className="shrink-0 font-mono text-[var(--color-brand-text-secondary)]">
              {cat.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-brand-border)] pt-4 space-y-3">
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
          How much do you want to save?
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Up to {basics.currency} {remainingPool.toLocaleString()} of your income is available after these expenses.
        </p>

        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={savingsPercent}
          onChange={(e) => setSavingsPercent(Number(e.target.value))}
          className="w-full accent-[var(--color-brand-red)]"
        />
        <div className="flex items-center justify-between text-xs text-[var(--color-brand-text-muted)]">
          <span>0%</span>
          <span className="font-mono text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {basics.currency} {savingsAmount.toLocaleString()}
          </span>
          <span>100%</span>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/50 p-3 text-center">
        <p className="text-xs text-[var(--color-brand-text-muted)]">Savings allocation</p>
        <p className="font-mono text-lg font-bold text-[var(--color-brand-green)]">
          {basics.currency} {savingsAmount.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-[var(--color-brand-green)]">Savings rate: {savingsRate}%</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              if (p.percent >= 0) setSavingsPercent(p.percent)
            }}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
              activePreset === p.label
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {rentAdjustHint ?
        <p className="text-xs text-[var(--color-brand-amber)]">{rentAdjustHint}</p>
      : null}

      {regenOpen ?
        <BuddgyRegenerateFeedback
          disabled={regenCount >= 3}
          onCancel={() => setRegenOpen(false)}
          onSubmit={(tweak: RegenerateTweak, note) => {
            submitRegenerateFeedback(tweak, note)
            setRegenOpen(false)
          }}
        />
      : null}

      {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setRegenOpen((o) => !o)}
          disabled={regenCount >= 3}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-xs font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-40 transition-colors"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Regenerate{regenCount > 0 ? ` (${regenCount}/3)` : ''}
        </button>

        <button
          type="button"
          onClick={() => void confirmAndApplyPlan()}
          disabled={loading || displayExpenseRows.length === 0 || basics.income <= 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Confirm plan
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
