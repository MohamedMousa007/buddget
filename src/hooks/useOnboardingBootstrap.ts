'use client'

import { useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { EXPERT_ONBOARDING_CONFIG } from '@/lib/onboarding/expertSurveyConfig'
import { mergeOnboardingAnswers, deriveAnswersFromFinanceStore } from '@/lib/onboarding/onboardingPrefill'

export function useOnboardingBootstrap(redo: boolean) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'survey' | 'plans'>('survey')
  const [answersReady, setAnswersReady] = useState(false)

  useEffect(() => {
    const full = useFinanceStore.getState()
    const derived = deriveAnswersFromFinanceStore(full)
    const merged = mergeOnboardingAnswers(full.onboardingState.answers, derived)
    setAnswers(merged)
    const maxI = Math.min(full.onboardingState.currentStepIndex, EXPERT_ONBOARDING_CONFIG.steps.length - 1)
    setIndex(Number.isFinite(maxI) && maxI >= 0 ? maxI : 0)
    if (full.onboardingState.aiPlans && full.onboardingState.aiPlans.length >= 1 && !full.onboardingState.planAccepted) {
      setPhase('plans')
    }
    setAnswersReady(true)
  }, [redo])

  return { answers, setAnswers, index, setIndex, phase, setPhase, answersReady }
}
