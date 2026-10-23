'use client'

import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { onboardingState, type OnboardingState } from '@/lib/onboarding/eligibility'
import { heldRecords } from '@/lib/onboarding/held'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

export const ONBOARDING_FLAG = 'onboarding_v1'

/** Whether to offer the journey now, and whether that answer can be trusted yet (flag and first sync both settled). */
export function useOnboardingState(): { state: OnboardingState; ready: boolean } {
  const { user } = useAuth()
  const flagOn = useFeatureFlag(ONBOARDING_FLAG, !!user)
  // The cached store counts as "loaded" before the server has answered; only a real pull proves the account is empty.
  const synced = useSettingsStore((s) => !!user && s.serverSyncedFor === user.id)
  const snap = useFinanceStore(
    useShallow((s) => ({
      profileLoaded: synced && s.dataReady && !!user && s.profile.id === user!.id,
      record: s.profile.financialProfile?.onboarding,
      ...heldRecords(s),
    })),
  )
  return { state: onboardingState({ flagOn, ...snap }), ready: !!user && flagOn !== null && snap.profileLoaded }
}
