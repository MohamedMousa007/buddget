'use client'

import { ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { OnboardingState } from '@/hooks/useOnboarding'

type IncomeTypeKey = 'salary' | 'freelance' | 'business' | 'other'

interface StepIncomeProps {
  state: OnboardingState
  onAmountChange: (v: string) => void
  onTypeChange: (v: IncomeTypeKey) => void
  onSubmit: () => void
  onSkip: () => void
}

/**
 * Step 4 — optional monthly income entry.
 * Completion (with or without income) happens in the review step.
 */
export function StepIncome({ state, onAmountChange, onTypeChange, onSubmit, onSkip }: StepIncomeProps) {
  const t = useT()
  const typeKeys: IncomeTypeKey[] = ['salary', 'freelance', 'business', 'other']
  const hasAmount = !!state.incomeAmount && parseFloat(state.incomeAmount) > 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
          {t.onboarding.incomeTitle}
        </h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.onboarding.incomeSubtitle}
        </p>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.onboarding.incomeAmountLabel}
        </label>
        <div className="relative">
          <span className="absolute start-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-brand-text-muted)] font-medium pointer-events-none">
            {state.currency}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={state.incomeAmount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] rounded-xl ps-16 pe-4 py-3 text-sm text-[var(--color-brand-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-red)]/50"
            placeholder="0"
          />
        </div>
      </div>

      {/* Income type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.onboarding.incomeTypeLabel}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {typeKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onTypeChange(key)}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${state.incomeTypeKey === key ? 'bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50'}`}
            >
              {t.onboarding.incomeTypes[key]}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={!hasAmount}
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
