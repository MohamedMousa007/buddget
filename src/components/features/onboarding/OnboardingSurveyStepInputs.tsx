'use client'

import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { Currency, OnboardingPaymentDraft } from '@/lib/store/types'
import {
  IncomeOnboardingPanel,
  type IncomeOnboardingPayload,
} from '@/components/onboarding/IncomeOnboardingPanel'
import { DebtOnboardingPanel, type DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import {
  SubscriptionsOnboardingPanel,
  type SubscriptionsOnboardingPayload,
} from '@/components/onboarding/SubscriptionsOnboardingPanel'
import { OnboardingPaymentMethodsBody } from '@/components/features/onboarding/OnboardingPaymentMethodsBody'

export interface OnboardingSurveyStepInputsProps {
  step: SurveyStep
  textValue: string
  setTextValue: (v: string) => void
  selected: string | null
  setSelected: (v: string | null) => void
  multi: string[]
  toggleMulti: (value: string) => void
  setPaymentDrafts: (d: OnboardingPaymentDraft[]) => void
  initialPaymentDrafts: OnboardingPaymentDraft[]
  incomePayload: IncomeOnboardingPayload
  setIncomePayload: (p: IncomeOnboardingPayload) => void
  debtPayload: DebtOnboardingPayload
  setDebtPayload: (p: DebtOnboardingPayload) => void
  subscriptionsPayload: SubscriptionsOnboardingPayload
  setSubscriptionsPayload: (p: SubscriptionsOnboardingPayload) => void
  baseCurrency: Currency
}

/**
 * Renders the interactive body for each `SurveyStep` type.
 */
export function OnboardingSurveyStepInputs({
  step,
  textValue,
  setTextValue,
  selected,
  setSelected,
  multi,
  toggleMulti,
  setPaymentDrafts,
  initialPaymentDrafts,
  incomePayload,
  setIncomePayload,
  debtPayload,
  setDebtPayload,
  subscriptionsPayload,
  setSubscriptionsPayload,
  baseCurrency,
}: OnboardingSurveyStepInputsProps) {
  const t = useT()

  if (step.type === 'static') {
    return <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">{step.body}</p>
  }
  if (step.type === 'text') {
    return (
      <Input
        value={textValue}
        maxLength={step.maxLength ?? 120}
        placeholder={step.placeholder ?? ''}
        onChange={(e) => setTextValue(e.target.value)}
        className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
      />
    )
  }
  if (step.type === 'number') {
    return (
      <Input
        type="text"
        inputMode="decimal"
        value={textValue}
        placeholder={step.placeholder ?? ''}
        onChange={(e) => setTextValue(e.target.value.replace(/[^\d.,]/g, ''))}
        className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
      />
    )
  }
  if (step.type === 'single_select') {
    return (
      <div className="grid gap-2">
        {step.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelected(opt.value)}
            className={`w-full text-start rounded-xl border px-4 py-3 text-sm transition-colors ${
              selected === opt.value
                ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }
  if (step.type === 'multi_select') {
    return (
      <div className="grid gap-2">
        {step.options.map((opt) => {
          const on = multi.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleMulti(opt.value)}
              className={`w-full text-start rounded-xl border px-4 py-3 text-sm transition-colors ${
                on
                  ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                  : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/40'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
        <p className="text-[10px] text-[var(--color-brand-text-muted)]">
          {t.common.selected(multi.length)}
          {step.minSelections != null ? ` ${t.common.pickAtLeast(step.minSelections)}` : ''}
          {step.maxSelections != null ? ` · ${t.common.upTo(step.maxSelections)}` : ''}
        </p>
      </div>
    )
  }
  if (step.type === 'payment_methods') {
    return (
      <OnboardingPaymentMethodsBody step={step} initialDrafts={initialPaymentDrafts} onChange={setPaymentDrafts} />
    )
  }
  if (step.type === 'income_entry') {
    return <IncomeOnboardingPanel entries={incomePayload.entries} onChange={setIncomePayload} />
  }
  if (step.type === 'debt_entry') {
    return <DebtOnboardingPanel entries={debtPayload.entries} onChange={setDebtPayload} />
  }
  if (step.type === 'subscriptions_detail') {
    return (
      <SubscriptionsOnboardingPanel
        lines={subscriptionsPayload.lines}
        baseCurrency={baseCurrency}
        onChange={setSubscriptionsPayload}
      />
    )
  }
  return null
}
