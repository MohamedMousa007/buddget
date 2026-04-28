'use client'

import { useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deriveAnswersFromFinanceStore, mergeOnboardingAnswers } from '@/lib/onboarding/onboardingPrefill'

/**
 * Hydrates `onboardingState.answers` into local state for survey steps.
 * URL drives step index; this hook only handles the answer bag.
 */
export function useOnboardingAnswers(redo: boolean) {
  const storeAnswers = useFinanceStore((s) => s.onboardingState.answers)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [answersReady, setAnswersReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const full = useFinanceStore.getState()
    const derived = deriveAnswersFromFinanceStore(full)
    const merged = mergeOnboardingAnswers(storeAnswers, derived)
    queueMicrotask(() => {
      if (cancelled) return
      setAnswers(merged)
      setAnswersReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [redo, storeAnswers])

  return { answers, setAnswers, answersReady }
}
