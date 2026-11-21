'use client'

import { isLivePlan } from '@/lib/budget/activePlan'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { effectivePlanCategoryAmount } from '@/lib/budget/budgetPlans'
import { useSmsArmed } from '@/hooks/useSmsTracking'
import { isSetUpAccount } from '@/lib/accounts/kinds'
import { isNative } from '@/lib/native/isNative'

export type SetupStepId = 'accounts' | 'sms' | 'payday' | 'budget' | 'expense'

export interface SetupStep {
  id: SetupStepId
  done: boolean
}

export interface SetupInputs {
  /** SMS capture can run here (the iOS and Android apps); on the web the step is left out. */
  smsAvailable: boolean
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

export function computeSetupSteps({ smsAvailable, hasAccount, smsArmed, hasPayday, hasBudget, hasTransaction }: SetupInputs) {
  const steps: SetupStep[] = [
    { id: 'accounts', done: hasAccount },
    ...(smsAvailable ? [{ id: 'sms' as const, done: smsArmed }] : []),
    { id: 'payday', done: hasPayday },
    { id: 'budget', done: hasBudget },
    { id: 'expense', done: hasTransaction },
  ]
  const doneCount = steps.filter((s) => s.done).length
  return { steps, doneCount, pct: Math.round((doneCount / steps.length) * 100) }
}

/** Setup checklist state derived from the stores, counting only the steps this platform can do; `hasTransaction` = any expense or income event. */
export function useSetupProgress(): SetupProgress {
  const smsArmed = useSmsArmed()
  const snap = useFinanceStore(
    useShallow((s) => ({
      hasAccount: s.paymentMethods.some(isSetUpAccount),
      hasPayday: s.incomeSources.some((i) => i.isRecurring),
      hasBudget: s.budgetPlans.filter(isLivePlan).some((p) => p.categories.some((c) => effectivePlanCategoryAmount(c) > 0)),
      hasTransaction: s.expenses.length + s.incomeEvents.length > 0,
    })),
  )
  return { ...computeSetupSteps({ smsAvailable: isNative(), smsArmed, ...snap }), hasTransaction: snap.hasTransaction }
}
