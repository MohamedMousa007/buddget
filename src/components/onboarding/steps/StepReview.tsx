'use client'

import type { ReactNode } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import { onboardingStepIndex, type StepId } from '@/lib/onboarding/steps'
import { ONBOARDING_BUDGET_STYLE_CARDS } from '@/lib/onboarding/personas'

function Section(props: {
  title: string
  stepId: StepId
  goTo?: (i: number) => void
  children: ReactNode
}) {
  const idx = onboardingStepIndex(props.stepId)
  return (
    <section className="bg-[#111118] border border-[#2A2A38] rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white">{props.title}</h3>
        <button
          type="button"
          onClick={() => props.goTo?.(idx)}
          className="text-xs text-[#E50914] hover:underline shrink-0"
          aria-label={`Edit ${props.title}`}
        >
          Edit →
        </button>
      </div>
      <div className="text-sm text-[#A0A0B8] space-y-1">{props.children}</div>
    </section>
  )
}

export function StepReview({ draft, goTo }: OnboardingStepProps) {
  const styleLabel =
    ONBOARDING_BUDGET_STYLE_CARDS.find((c) => c.budgetStyle === draft.budgetStyle)?.title ??
    draft.budgetStyle

  const incomeLines = draft.incomeSources.filter((i) => i.name.trim() && i.amount > 0)
  const subLines = draft.subscriptions.filter((s) => s.name.trim())
  const debtLines = draft.debts.filter((d) => d.name.trim() || d.person.trim())

  return (
    <div className="w-full max-w-lg mx-auto pb-4 flex-1 flex flex-col">
      <Section title="About you" stepId="welcome" goTo={goTo}>
        <p>Name: {draft.name.trim() || '—'}</p>
        <p>Country: {draft.country.trim() || '—'}</p>
        <p>Currency: {draft.baseCurrency}</p>
      </Section>

      <Section title="Income" stepId="income" goTo={goTo}>
        {incomeLines.length ?
          incomeLines.map((i, k) => (
            <p key={k}>
              {i.name}: {i.amount} {i.currency}
            </p>
          ))
        : <p>No sources entered</p>}
      </Section>

      <Section title="Fixed costs" stepId="fixed-costs" goTo={goTo}>
        {draft.fixedCosts.length ?
          draft.fixedCosts.map((f, k) => (
            <p key={k}>
              {f.name}: {f.amount} {draft.baseCurrency} ({f.category})
            </p>
          ))
        : <p>None</p>}
      </Section>

      <Section title="Subscriptions" stepId="subscriptions" goTo={goTo}>
        {subLines.length ?
          subLines.map((s, k) => (
            <p key={k}>
              {s.name}: {draft.baseCurrency} {s.amount || '—'} / mo
            </p>
          ))
        : <p>None selected</p>}
      </Section>

      <Section title="Payment methods" stepId="payment-methods" goTo={goTo}>
        {draft.paymentMethods.length ?
          draft.paymentMethods.map((p, k) => (
            <p key={k}>
              {p.name} ({p.type})
            </p>
          ))
        : <p>None</p>}
      </Section>

      <Section title="Savings goal" stepId="savings-goal" goTo={goTo}>
        <p>
          {draft.savingsGoal != null && draft.savingsGoal > 0 ?
            `${draft.baseCurrency} ${draft.savingsGoal} / month`
          : 'Not set'}
        </p>
      </Section>

      <Section title="Debts" stepId="debts" goTo={goTo}>
        {debtLines.length ?
          debtLines.map((d, k) => (
            <p key={k}>
              {d.name || d.person}: {d.isGold ? `${d.startingBalance} g` : `${d.startingBalance} ${d.currency}`}
            </p>
          ))
        : <p>None</p>}
      </Section>

      <Section title="Budget style" stepId="budget-style" goTo={goTo}>
        <p>{styleLabel}</p>
      </Section>
    </div>
  )
}
