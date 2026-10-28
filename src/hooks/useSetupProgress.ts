'use client'

import { isLivePlan } from '@/lib/budget/activePlan'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { effectivePlanCategoryAmount } from '@/lib/budget/budgetPlans'
import { useSmsArmed } from '@/hooks/useSmsTracking'
import { isOpenAccount } from '@/lib/accounts/kinds'

export type SetupStepId = 'accounts' | 'sms' | 'payday' | 'budget' | 'expense'

export interface SetupStep {
  id: SetupStepId
  done: boolean
}

export interface SetupInputs {
  hasAccount: boolean
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

export function computeSetupSteps({ hasAccount, smsArmed, hasPayday, hasBudget, hasTransaction }: SetupInputs) {
  const steps: SetupStep[] = [
    { id: 'accounts', done: hasAccount },
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
      hasAccount: s.paymentMethods.some(isOpenAccount),
      hasPayday: s.incomeSources.some((i) => i.isRecurring),
      hasBudget: s.budgetPlans.filter(isLivePlan).some((p) => p.categories.some((c) => effectivePlanCategoryAmount(c) > 0)),
      hasTransaction: s.expenses.length + s.incomeEvents.length > 0,
    })),
  )
  return { ...computeSetupSteps({ smsArmed, ...snap }), hasTransaction: snap.hasTransaction }
}
