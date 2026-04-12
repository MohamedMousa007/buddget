'use client'

import { Check, Pencil, RefreshCcw } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'

/**
 * Step 4: Plan preview — branded summary card.
 * User can edit inline, apply, or regenerate.
 */
export function BuddgyStepPlan({ flow }: { flow: BuddgyBuilderApi }) {
  const { plan, editingPlan, setEditingPlan, editedCategories, updateEditedCategory, applyPlan, goBackToLifestyle, regenCount, basics } = flow

  if (!plan) return null

  const categories = editingPlan ? editedCategories : plan.categories
  const totalExpenses = categories.filter((c) => c.name !== 'Savings').reduce((s, c) => s + c.amount, 0)
  const savingsRow = categories.find((c) => c.name === 'Savings')
  const savingsAmt = savingsRow?.amount ?? 0
  const buffer = Math.max(0, basics.income - totalExpenses - savingsAmt)
  const savingsRate = basics.income > 0 ? Math.round((savingsAmt / basics.income) * 100) : 0

  const rateColor =
    savingsRate >= 30 ? 'text-[var(--color-brand-green)]'
    : savingsRate >= 15 ? 'text-[var(--color-brand-amber)]'
    : 'text-[var(--color-brand-red)]'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          Your Plan
        </p>

        <div className="divide-y divide-[var(--color-brand-border)]">
          {categories.filter((c) => c.name !== 'Savings').map((cat, i) => (
            <div key={cat.name} className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--color-brand-text-primary)]">
                {cat.emoji} {cat.name}
              </span>
              {editingPlan ? (
                <input
                  type="number"
                  value={cat.amount}
                  onChange={(e) => updateEditedCategory(i, Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1 text-right text-sm font-mono text-[var(--color-brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)]/40"
                />
              ) : (
                <span className="text-sm font-mono text-[var(--color-brand-text-primary)]">
                  {basics.currency} {cat.amount.toLocaleString()}
                </span>
              )}
            </div>
          ))}

          <div className="border-t-2 border-[var(--color-brand-border)]" />

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[var(--color-brand-text-muted)]">Total expenses</span>
            <span className="text-sm font-mono font-semibold text-[var(--color-brand-text-primary)]">
              {basics.currency} {totalExpenses.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[var(--color-brand-text-primary)]">💰 Savings</span>
            <span className="text-sm font-mono font-semibold text-[var(--color-brand-green)]">
              {basics.currency} {savingsAmt.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[var(--color-brand-text-primary)]">🔓 Buffer</span>
            <span className="text-sm font-mono text-[var(--color-brand-text-secondary)]">
              {basics.currency} {buffer.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-brand-border)]">
          <p className={`text-lg font-mono font-bold ${rateColor}`}>
            Savings rate: {savingsRate}%
          </p>
        </div>

        {plan.tip && (
          <p className="text-sm italic text-[var(--color-brand-text-secondary)]">
            {plan.tip}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={applyPlan}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
        >
          <Check className="h-4 w-4" />
          Apply this plan
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingPlan(!editingPlan)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] py-2.5 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editingPlan ? 'Done editing' : 'Edit amounts'}
          </button>

          <button
            type="button"
            onClick={goBackToLifestyle}
            disabled={regenCount >= 3}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] py-2.5 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-40 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  )
}
