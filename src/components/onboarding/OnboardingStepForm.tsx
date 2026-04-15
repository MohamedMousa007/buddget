'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { IncomeSource, OnboardingPaymentDraft } from '@/lib/store/types'
import type { IncomeOnboardingPayload } from '@/components/onboarding/IncomeOnboardingPanel'
import type { DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import { OnboardingSurveyStepHeader } from '@/components/features/onboarding/OnboardingSurveyStepHeader'
import { OnboardingSurveyStepInputs } from '@/components/features/onboarding/OnboardingSurveyStepInputs'
import { OnboardingSurveyContinueButton } from '@/components/features/onboarding/OnboardingSurveyContinueButton'
import type { StepContinuePayload } from '@/lib/onboarding/onboardingStepPayload'

export type { StepContinuePayload }

const WIDE_STEPS = new Set<SurveyStep['type']>([
  'income_entry',
  'debt_entry',
  'subscriptions_detail',
  'goals_detail',
  'savings_detail',
])

export function OnboardingStepForm({
  step,
  initialText,
  initialSelected,
  initialMulti,
  initialPaymentDrafts,
  initialIncomeEntries,
  initialDebtEntries,
  loadError,
  isLastSurveyStep,
  finishing,
  planLoading,
  onContinue,
}: {
  step: SurveyStep
  initialText: string
  initialSelected: string | null
  initialMulti: string[]
  initialPaymentDrafts: OnboardingPaymentDraft[]
  initialIncomeEntries: Omit<IncomeSource, 'id' | 'createdAt'>[]
  initialDebtEntries: DebtOnboardingPayload['entries']
  loadError: string | null
  isLastSurveyStep: boolean
  finishing: boolean
  planLoading: boolean
  onContinue: (payload: StepContinuePayload) => void | Promise<void>
}) {
  const [textValue, setTextValue] = useState(initialText)
  const [selected, setSelected] = useState<string | null>(initialSelected)
  const [multi, setMulti] = useState<string[]>(initialMulti)
  const [paymentDrafts, setPaymentDrafts] = useState<OnboardingPaymentDraft[]>(initialPaymentDrafts)
  const [incomePayload, setIncomePayload] = useState<IncomeOnboardingPayload>(() => ({
    entries: initialIncomeEntries,
  }))
  const [debtPayload, setDebtPayload] = useState<DebtOnboardingPayload>(() => ({
    entries: initialDebtEntries,
  }))

  const canContinue = useMemo(() => {
    if (step.type === 'static') return true
    if (step.type === 'text') return textValue.trim().length > 0
    if (step.type === 'number') {
      const raw = textValue.replace(/,/g, '.').replace(/\.(?=.*\.)/g, '')
      const n = parseFloat(raw)
      const min = step.min ?? 0
      const max = step.max
      if (!Number.isFinite(n) || n < min) return false
      if (max != null && n > max) return false
      return true
    }
    if (step.type === 'single_select') return !!selected
    if (step.type === 'multi_select') {
      const min = step.minSelections ?? 1
      const max = step.maxSelections ?? 99
      return multi.length >= min && multi.length <= max
    }
    if (step.type === 'payment_methods') {
      return paymentDrafts.length > 0 && paymentDrafts.every((d) => d.nickname.trim().length > 0)
    }
    if (
      step.type === 'income_entry' ||
      step.type === 'debt_entry' ||
      step.type === 'subscriptions_detail' ||
      step.type === 'goals_detail' ||
      step.type === 'savings_detail'
    ) {
      return true
    }
    return false
  }, [step, textValue, selected, multi, paymentDrafts])

  const toggleMulti = (value: string) => {
    setMulti((prev) => {
      const max = step.type === 'multi_select' ? step.maxSelections ?? 99 : 99
      if (prev.includes(value)) return prev.filter((v) => v !== value)
      if (prev.length >= max) return prev
      return [...prev, value]
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2 }}
      className={`glass-card rounded-2xl p-6 w-full flex flex-col gap-5 self-center ${
        WIDE_STEPS.has(step.type) ? 'max-w-2xl' : 'max-w-lg'
      }`}
    >
      <OnboardingSurveyStepHeader step={step} loadError={loadError} />
      <OnboardingSurveyStepInputs
        step={step}
        textValue={textValue}
        setTextValue={setTextValue}
        selected={selected}
        setSelected={setSelected}
        multi={multi}
        toggleMulti={toggleMulti}
        setPaymentDrafts={setPaymentDrafts}
        initialPaymentDrafts={initialPaymentDrafts}
        incomePayload={incomePayload}
        setIncomePayload={setIncomePayload}
        debtPayload={debtPayload}
        setDebtPayload={setDebtPayload}
      />
      <OnboardingSurveyContinueButton
        step={step}
        canContinue={canContinue}
        finishing={finishing}
        planLoading={planLoading}
        isLastSurveyStep={isLastSurveyStep}
        onContinue={onContinue}
        textValue={textValue}
        selected={selected}
        multi={multi}
        paymentDrafts={paymentDrafts}
        incomePayload={incomePayload}
        debtPayload={debtPayload}
      />
    </motion.div>
  )
}
