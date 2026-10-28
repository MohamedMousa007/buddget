'use client'

import { useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { navigate } from '@/lib/navigation/navigate'
import { trackOnboarding } from '@/lib/onboarding/track'
import { STEPS } from '@/lib/onboarding/steps'
import type { OnboardingGoal, OnboardingRecord } from '@/lib/store/types'

const store = () => useFinanceStore.getState()

/** Merges a change into the saved journey record on the profile (which syncs), creating it on first use. */
export function writeOnboardingRecord(patch: Partial<OnboardingRecord>): OnboardingRecord {
  const { profile, updateProfile } = store()
  const prev = profile.financialProfile?.onboarding
  const next: OnboardingRecord = { v: 1, step: 0, startedAt: new Date().toISOString(), ...prev, ...patch }
  updateProfile({ financialProfile: { ...profile.financialProfile, onboarding: next } })
  return next
}

/** The journey's progress, kept on the profile so it syncs and resumes on any device. */
export function useOnboarding() {
  const record = useFinanceStore((s) => s.profile.financialProfile?.onboarding)

  const begin = useCallback(() => {
    if (!store().profile.financialProfile?.onboarding) {
      writeOnboardingRecord({})
      trackOnboarding('onboarding_started')
    }
  }, [])

  const goTo = useCallback((step: number) => writeOnboardingRecord({ step: Math.max(0, Math.min(STEPS.length - 1, step)) }), [])
  const setGoals = useCallback((goals: OnboardingGoal[]) => writeOnboardingRecord({ goals }), [])
  const patch = useCallback((p: Partial<OnboardingRecord>) => writeOnboardingRecord(p), [])

  /** Leaves for now. The progress stays, and the Flow card offers to continue. */
  const leave = useCallback(() => {
    writeOnboardingRecord({ skippedAt: new Date().toISOString() })
    trackOnboarding('onboarding_skipped', { step: record?.step ?? 0 })
    navigate('/flow', { replace: true })
  }, [record?.step])

  /** Picks it up again from Flow. */
  const resume = useCallback(() => {
    writeOnboardingRecord({ skippedAt: undefined })
    navigate('/start')
  }, [])

  const finish = useCallback((openBudget: boolean) => {
    writeOnboardingRecord({ doneAt: new Date().toISOString(), skippedAt: undefined })
    trackOnboarding('onboarding_completed', { budget: openBudget })
    if (openBudget) useSettingsStore.getState().requestBudgetStudio()
    navigate(openBudget ? '/budget-setup' : '/flow', { replace: true })
  }, [])

  return { record, begin, goTo, setGoals, patch, leave, resume, finish }
}
