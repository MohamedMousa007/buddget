'use client'

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, OnboardingAiPlan, OnboardingState } from '@/lib/store/types'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'

export function useOnboardingPlansRequest({
  profileCountry,
  profileCity,
  baseCurrency,
  setOnboardingState,
  setPhase,
}: {
  profileCountry: string | undefined
  profileCity: string | undefined
  baseCurrency: Currency
  setOnboardingState: (
    updates: Partial<OnboardingState> | ((prev: OnboardingState) => OnboardingState)
  ) => void
  setPhase: Dispatch<SetStateAction<'survey' | 'plans'>>
}) {
  const [planLoading, setPlanLoading] = useState(false)

  const requestPlans = useCallback(
    async (nextAnswers: Record<string, unknown>) => {
      setPlanLoading(true)
      try {
        const country = String(nextAnswers.country || profileCountry || '').trim() || 'Unknown'
        const city = String(nextAnswers.city || profileCity || '').trim() || 'Unknown'
        const base = (nextAnswers.base_currency as Currency) || baseCurrency
        const st = useFinanceStore.getState()
        const monthlyTakeHome = calculateMonthlyIncome(st.incomeSources, base, st.exchangeRates)

        const res = await fetch('/api/onboarding/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country,
            city,
            currency: base,
            monthlyTakeHome,
            answers: nextAnswers,
          }),
        })
        const data = await res.json()
        const loadedPlans = (data.plans || []) as OnboardingAiPlan[]
        const notes = (data.validationNotes || []) as string[]
        if (!res.ok || loadedPlans.length < 1) {
          setOnboardingState({
            lastValidationNotes: [data.error || 'Could not load plans.'],
            aiPlans: null,
          })
          setPhase('plans')
          return
        }
        setOnboardingState({
          aiPlans: loadedPlans.slice(0, 3),
          lastValidationNotes: notes,
          aiGeneratedAt: new Date().toISOString(),
          selectedPlanIndex: 0,
        })
        setPhase('plans')
      } finally {
        setPlanLoading(false)
      }
    },
    [baseCurrency, profileCity, profileCountry, setOnboardingState, setPhase]
  )

  return { requestPlans, planLoading }
}
