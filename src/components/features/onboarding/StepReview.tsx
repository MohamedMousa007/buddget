'use client'

import { Pencil, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { OnboardingState } from '@/hooks/useOnboarding'
import { ONBOARDING_COUNTRIES } from '@/hooks/useOnboarding'

interface StepReviewProps {
  state: OnboardingState
  onEdit: (step: OnboardingState['step']) => void
  onSubmit: () => void
  onSkipIncome: (liteMode: boolean) => void
}

/**
 * Step 5 — review all collected data before finishing.
 * All edit controls are <button> elements, never links.
 */
export function StepReview({ state, onEdit, onSubmit, onSkipIncome }: StepReviewProps) {
  const t = useT()
  const country = ONBOARDING_COUNTRIES.find((c) => c.code === state.country)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
          {t.onboarding.reviewTitle}
        </h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.onboarding.reviewSubtitle}
        </p>
      </div>

      <ReviewSection
        label={t.onboarding.reviewSectionIdentity}
        onEdit={() => onEdit(1)}
      >
        <span className="text-sm text-[var(--color-brand-text-primary)]">
          {state.name} · {country?.flag} {country?.name} · {state.currency}
          {state.secondaryCurrency ? ` / ${state.secondaryCurrency}` : ''}
        </span>
      </ReviewSection>

      <ReviewSection
        label={t.onboarding.reviewSectionGoals}
        onEdit={() => onEdit(2)}
      >
        {state.financialGoals.length > 0 ? (
          <span className="text-sm text-[var(--color-brand-text-primary)]">
            {state.financialGoals.map((g) => t.onboarding.goalLabels[g]).join(', ')}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-brand-text-muted)]">{t.onboarding.reviewNoneSelected}</span>
        )}
      </ReviewSection>

      <ReviewSection
        label={t.onboarding.reviewSectionSpending}
        onEdit={() => onEdit(3)}
      >
        <div className="text-sm text-[var(--color-brand-text-primary)] space-y-0.5">
          {state.incomeRange && (
            <p>{t.onboarding.incomeRangeLabels[state.incomeRange]}</p>
          )}
          {state.moneyManagementMethod && (
            <p className="text-[var(--color-brand-text-muted)]">
              {t.onboarding.moneyManagementLabels[state.moneyManagementMethod]}
            </p>
          )}
          {state.spendingCategories.length > 0 && (
            <p className="text-[var(--color-brand-text-muted)]">
              {state.spendingCategories.map((c) => t.onboarding.categoryLabels[c]).join(', ')}
            </p>
          )}
          {state.incomeRange === '' && state.moneyManagementMethod === '' && state.spendingCategories.length === 0 && (
            <span className="text-[var(--color-brand-text-muted)]">{t.onboarding.reviewNoneSelected}</span>
          )}
        </div>
      </ReviewSection>

      <ReviewSection
        label={t.onboarding.reviewSectionIncome}
        onEdit={() => onEdit(4)}
      >
        {state.incomeAmount && parseFloat(state.incomeAmount) > 0 ? (
          <span className="text-sm text-[var(--color-brand-text-primary)]">
            {state.currency} {parseFloat(state.incomeAmount).toLocaleString()} / {t.onboarding.incomeTypes[state.incomeTypeKey]}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-brand-text-muted)]">{t.onboarding.reviewSkipped}</span>
        )}
      </ReviewSection>

      {state.error && (
        <p className="text-xs text-[var(--color-brand-red)] text-center">{state.error}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={state.submitting}
        className="w-full py-3.5 rounded-xl font-medium text-sm transition-colors bg-[var(--color-brand-red)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {state.submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            {t.onboarding.finishing}
          </>
        ) : (
          t.onboarding.reviewFinishButton
        )}
      </button>

      {!state.submitting && (
        <button
          type="button"
          onClick={() => onSkipIncome(false)}
          className="w-full text-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors"
        >
          {t.onboarding.skipForNow}
        </button>
      )}
    </div>
  )
}

function ReviewSection({
  label,
  onEdit,
  children,
}: {
  label: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {label}
          </p>
          {children}
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
