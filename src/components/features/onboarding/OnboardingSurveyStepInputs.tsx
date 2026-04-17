'use client'

import { Input } from '@/components/ui/input'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { useLocale, useT } from '@/lib/i18n'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { OnboardingPaymentDraft } from '@/lib/store/types'
import {
  IncomeOnboardingPanel,
  type IncomeOnboardingPayload,
} from '@/components/onboarding/IncomeOnboardingPanel'
import { DebtOnboardingPanel, type DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import { SubscriptionsOnboardingPanel } from '@/components/onboarding/SubscriptionsOnboardingPanel'
import { GoalsOnboardingPanel } from '@/components/onboarding/GoalsOnboardingPanel'
import { SavingsOnboardingPanel } from '@/components/onboarding/SavingsOnboardingPanel'
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
}: OnboardingSurveyStepInputsProps) {
  const t = useT()
  const { locale } = useLocale()

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
  if (step.type === 'country_select') {
    return (
      <CountrySelect
        value={textValue}
        onChange={(v) => setTextValue(v)}
        locale={locale}
        placeholder={step.placeholder ?? ''}
        className="w-full h-11 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-[var(--color-brand-text-primary)] outline-none focus:border-[var(--color-brand-text-secondary)] focus:ring-1 focus:ring-[var(--color-brand-text-secondary)]/30"
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
    return <SubscriptionsOnboardingPanel />
  }
  if (step.type === 'goals_detail') {
    return <GoalsOnboardingPanel />
  }
  if (step.type === 'savings_detail') {
    return <SavingsOnboardingPanel />
  }
  return null
}
