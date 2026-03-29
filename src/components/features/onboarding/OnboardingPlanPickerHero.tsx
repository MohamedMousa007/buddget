'use client'

import { Target } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import type { OnboardingAiPlan } from '@/lib/store/types'
import type { Currency } from '@/lib/store/types'
import { shortPlanLine } from '@/lib/onboarding/planPickerCopy'

export function OnboardingPlanPickerHero({
  idx,
  plansLength,
  plan,
  monthlyTakeHome,
  baseCurrency,
}: {
  idx: number
  plansLength: number
  plan: OnboardingAiPlan
  monthlyTakeHome: number
  baseCurrency: Currency
}) {
  const t = useT()
  const o = t.onboarding

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div className="space-y-2 min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          {o.planPickerPlanIndex(idx + 1, plansLength)}
        </p>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-red)]/15 text-[var(--color-brand-red)] shrink-0">
            <Target className="w-4 h-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white font-heading leading-tight">{plan.label}</h2>
            <p className="text-sm text-[var(--color-brand-red)] font-medium mt-0.5">{plan.personaLabel}</p>
            <p className="text-xs text-[var(--color-brand-text-secondary)] mt-1">{plan.personaTagline}</p>
          </div>
        </div>
        {plan.rationale ? (
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-snug">
            {shortPlanLine(plan.rationale, 160)}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/50 px-4 py-3 shrink-0 lg:min-w-[220px]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-1">
          {o.planPickerMonthlyTakeHome}
        </p>
        <MoneyDisplay
          variant="card"
          amount={monthlyTakeHome}
          currency={baseCurrency}
          primaryClassName="text-lg font-semibold text-white"
          secondaryClassName="text-[11px]"
        />
      </div>
    </div>
  )
}
