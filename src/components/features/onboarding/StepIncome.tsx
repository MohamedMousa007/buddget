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
  onSkip: (liteMode: boolean) => void
}

/**
 * Step 2 — optional monthly income entry with Lite Mode skip option.
 */
export function StepIncome({ state, onAmountChange, onTypeChange, onSubmit, onSkip }: StepIncomeProps) {
  const t = useT()
  const typeKeys: IncomeTypeKey[] = ['salary', 'freelance', 'business', 'other']

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
        disabled={!state.incomeAmount || state.submitting}
        className="w-full py-3.5 rounded-xl font-medium text-sm transition-colors bg-[var(--color-brand-red)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {state.submitting ? t.onboarding.finishing : t.onboarding.continueButton}
        {!state.submitting && <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden />}
      </button>

      {/* Lite Mode skip banner */}
      <LiteModeBanner state={state} onSkip={onSkip} />

      {state.error && (
        <p className="text-xs text-[var(--color-brand-red)] text-center">{state.error}</p>
      )}
    </div>
  )
}

function LiteModeBanner({
  state,
  onSkip,
}: {
  state: OnboardingState
  onSkip: (liteMode: boolean) => void
}) {
  const t = useT()
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
          {t.onboarding.liteModeTitle}
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-1 leading-relaxed">
          {t.onboarding.liteModeDesc}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSkip(true)}
          disabled={state.submitting}
          className="flex-1 py-2 rounded-xl text-xs font-medium bg-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {t.onboarding.useLiteMode}
        </button>
        <button
          onClick={() => onSkip(false)}
          disabled={state.submitting}
          className="flex-1 py-2 rounded-xl text-xs font-medium border border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors disabled:opacity-40"
        >
          {t.onboarding.skipForNow}
        </button>
      </div>
    </div>
  )
}
