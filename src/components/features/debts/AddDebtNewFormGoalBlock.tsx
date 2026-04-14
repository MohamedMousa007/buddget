'use client'

import type { DebtCurrency, DebtGoal, DebtKind } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

export function AddDebtNewFormGoalBlock({
  debtType,
  currency,
  goalDraft,
  onOpenGoal,
  onClearGoal,
}: {
  debtType: DebtKind
  currency: DebtCurrency
  goalDraft: DebtGoal | null
  onOpenGoal: () => void
  onClearGoal: () => void
}) {
  const t = useT()
  if (debtType === 'credit_card') return null

  return (
    <div className="space-y-2">
      {goalDraft ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm">
          <button type="button" onClick={onOpenGoal} className="min-w-0 flex-1 text-left">
            <span>🎯</span>{' '}
            <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
              {formatCurrency(goalDraft.calculatedAmount, currency)}/
              {goalDraft.paymentFrequency === 'monthly' ? 'mo' : goalDraft.paymentFrequency} until{' '}
              {goalDraft.targetDate.slice(0, 7)}
            </span>
          </button>
          <button
            type="button"
            onClick={onClearGoal}
            className="text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
            aria-label={t.addDebt.goalChipRemoveAria}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenGoal}
          className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/25 transition-colors"
        >
          {t.addDebt.goalTrigger}
        </button>
      )}
    </div>
  )
}
