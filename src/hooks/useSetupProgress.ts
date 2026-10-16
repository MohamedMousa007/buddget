'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { effectivePlanCategoryAmount } from '@/lib/budget/budgetPlans'
import { useSmsArmed } from '@/hooks/useSmsTracking'

export type SetupStepId = 'sms' | 'payday' | 'budget' | 'expense'

export interface SetupStep {
  id: SetupStepId
  done: boolean
}

export interface SetupInputs {
  smsArmed: boolean
  hasPayday: boolean
  hasBudget: boolean
  hasTransaction: boolean
}

export interface SetupProgress {
  steps: SetupStep[]
  doneCount: number
  pct: number
  hasTransaction: boolean
}

export function computeSetupSteps({ smsArmed, hasPayday, hasBudget, hasTransaction }: SetupInputs) {
  const steps: SetupStep[] = [
    { id: 'sms', done: smsArmed },
    { id: 'payday', done: hasPayday },
    { id: 'budget', done: hasBudget },
    { id: 'expense', done: hasTransaction },
  ]
  const doneCount = steps.filter((s) => s.done).length
  return { steps, doneCount, pct: Math.round((doneCount / steps.length) * 100) }
}

/** Setup checklist state derived from the stores; `hasTransaction` = any expense or income event. */
export function useSetupProgress(): SetupProgress {
  const smsArmed = useSmsArmed()
  const snap = useFinanceStore(
    useShallow((s) => ({
      hasPayday: s.incomeSources.some((i) => i.isRecurring),
      hasBudget: s.budgetPlans.some((p) => p.categories.some((c) => effectivePlanCategoryAmount(c) > 0)),
      hasTransaction: s.expenses.length + s.incomeEvents.length > 0,
    })),
  )
  return { ...computeSetupSteps({ smsArmed, ...snap }), hasTransaction: snap.hasTransaction }
}
