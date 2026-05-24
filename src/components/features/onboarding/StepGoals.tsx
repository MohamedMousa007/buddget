'use client'

import { ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { FinancialGoal, OnboardingState } from '@/hooks/useOnboarding'

interface StepGoalsProps {
  state: OnboardingState
  onToggleGoal: (goal: FinancialGoal) => void
  onNext: () => void
  onSkip: () => void
}

const GOAL_KEYS: FinancialGoal[] = [
  'emergency_fund',
  'pay_debt',
  'big_purchase',
  'investments',
  'daily_tracking',
  'reduce_expenses',
]

const GOAL_ICONS: Record<FinancialGoal, string> = {
  emergency_fund: '🛡️',
  pay_debt: '📉',
  big_purchase: '🏠',
  investments: '📈',
  daily_tracking: '📊',
  reduce_expenses: '✂️',
}

/**
 * Step 2 — financial goals multi-select.
 */
export function StepGoals({ state, onToggleGoal, onNext, onSkip }: StepGoalsProps) {
  const t = useT()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
          {t.onboarding.goalsTitle}
        </h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.onboarding.goalsSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {GOAL_KEYS.map((goal) => {
          const active = state.financialGoals.includes(goal)
          return (
            <button
              key={goal}
              type="button"
              onClick={() => onToggleGoal(goal)}
              className={`rounded-xl border px-3 py-3 text-start transition-colors ${active ? 'bg-[var(--color-brand-red)]/10 border-[var(--color-brand-red)] text-[var(--color-brand-text-primary)]' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50'}`}
            >
              <span className="block text-base mb-1" aria-hidden>{GOAL_ICONS[goal]}</span>
              <span className="text-xs font-medium leading-snug">
                {t.onboarding.goalLabels[goal]}
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        disabled={state.financialGoals.length === 0}
        className="w-full py-3.5 rounded-xl font-medium text-sm transition-colors bg-[var(--color-brand-red)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {t.onboarding.continueButton}
        <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden />
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors"
      >
        {t.onboarding.skipForNow}
      </button>
    </div>
  )
}
