'use client'

import { useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { expertSurveyStepCount } from '@/lib/onboarding/onboardingProgress'
import { mergeOnboardingAnswers, deriveAnswersFromFinanceStore } from '@/lib/onboarding/onboardingPrefill'

export type OnboardingPhase = 'survey' | 'buddgy'

export function useOnboardingBootstrap(redo: boolean) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<OnboardingPhase>('survey')
  const [answersReady, setAnswersReady] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate onboarding UI from persisted store on mount / redo */
    const full = useFinanceStore.getState()
    const derived = deriveAnswersFromFinanceStore(full)
    const merged = mergeOnboardingAnswers(full.onboardingState.answers, derived)
    setAnswers(merged)
    const maxI = Math.min(full.onboardingState.currentStepIndex, expertSurveyStepCount() - 1)
    setIndex(Number.isFinite(maxI) && maxI >= 0 ? maxI : 0)
    setAnswersReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [redo])

  return { answers, setAnswers, index, setIndex, phase, setPhase, answersReady }
}
