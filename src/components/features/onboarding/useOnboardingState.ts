'use client'

import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { isOpenAccount } from '@/lib/accounts/kinds'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { onboardingState, type OnboardingState } from '@/lib/onboarding/eligibility'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export const ONBOARDING_FLAG = 'onboarding_v1'

/** Whether to offer the journey now, and whether that answer can be trusted yet (flag and first sync both settled). */
export function useOnboardingState(): { state: OnboardingState; ready: boolean } {
  const { user } = useAuth()
  const flagOn = useFeatureFlag(ONBOARDING_FLAG, !!user)
  const snap = useFinanceStore(
    useShallow((s) => ({
      profileLoaded: !!user && s.dataReady && s.profile.id === user.id,
      record: s.profile.financialProfile?.onboarding,
      openAccounts: s.paymentMethods.filter(isOpenAccount).length,
      incomeSources: s.incomeSources.length,
      incomeEvents: s.incomeEvents.length,
      expenses: s.expenses.length,
      plans: s.budgetPlans.length,
    })),
  )
  return { state: onboardingState({ flagOn, ...snap }), ready: !!user && flagOn !== null && snap.profileLoaded }
}
