'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { expertSurveyStepCount } from '@/lib/onboarding/onboardingProgress'
import {
  applyDebtFromOnboarding,
  applyIncomeFromOnboarding,
  applyLocaleFromProfile,
  applyMapsTo,
} from '@/lib/onboarding/onboardingPageHelpers'
import type { StepContinuePayload } from '@/components/onboarding/OnboardingStepForm'
import { useOnboardingSurveyConfig } from '@/hooks/useOnboardingSurveyConfig'
import { useOnboardingBootstrap } from '@/hooks/useOnboardingBootstrap'
import { useOnboardingPlansRequest } from '@/hooks/useOnboardingPlansRequest'
import { useFinishOnboarding } from '@/hooks/useFinishOnboarding'

export function useOnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redo = searchParams.get('redo') === '1'

  const { supabase, config, loadError } = useOnboardingSurveyConfig()
  const { answers, setAnswers, index, setIndex, phase, setPhase, answersReady } = useOnboardingBootstrap(redo)

  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const setOnboardingState = useFinanceStore((s) => s.setOnboardingState)
  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)
  const plans = useFinanceStore((s) => s.onboardingState.aiPlans)
  const valNotes = useFinanceStore((s) => s.onboardingState.lastValidationNotes)

  const { requestPlans, planLoading } = useOnboardingPlansRequest({
    profileCountry: profile.country,
    profileCity: profile.city,
    baseCurrency: settings.baseCurrency,
    setOnboardingState,
    setPhase,
  })

  const steps = config.steps
  const step = steps[index]
  const { finishOnboarding, finishing } = useFinishOnboarding({
    answers,
    redo,
    router,
    stepsLength: steps.length,
    supabase,
  })

  const surveyTotal = expertSurveyStepCount()
  const isLastSurveyStep = step?.id === 'pre_plan'

  const persistAnswers = useCallback(
    (next: Record<string, unknown>, nextIndex: number) => {
      setAnswers(next)
      setOnboardingState({
        answers: next,
        currentStepIndex: nextIndex,
      })
    },
    [setAnswers, setOnboardingState]
  )

  const handleStepContinue = useCallback(
    async (payload: StepContinuePayload) => {
      if (!step) return

      if (payload.kind === 'income') applyIncomeFromOnboarding(payload.payload.entries)
      if (payload.kind === 'debt') applyDebtFromOnboarding(payload.payload.entries)

      let rawAnswer: unknown = null
      if (payload.kind === 'text') rawAnswer = payload.textValue.trim()
      else if (payload.kind === 'number') {
        const r = payload.textValue.replace(/,/g, '.').replace(/\.(?=.*\.)/g, '')
        rawAnswer = parseFloat(r)
      } else if (payload.kind === 'single') rawAnswer = payload.selected
      else if (payload.kind === 'multi') rawAnswer = payload.values
      else if (payload.kind === 'payment') rawAnswer = payload.drafts
      else if (payload.kind === 'income') rawAnswer = payload.payload
      else if (payload.kind === 'debt') rawAnswer = payload.payload
      else if (payload.kind === 'subscriptions') rawAnswer = payload.payload

      const nextAnswers = step.type === 'static' ? answers : { ...answers, [step.id]: rawAnswer }

      if (step.type === 'text' && typeof rawAnswer === 'string') {
        applyMapsTo(step.mapsTo, rawAnswer, updateProfile, updateSettings)
        // Cascade baseCurrency + pristine defaults when country/city land.
        if (step.mapsTo === 'profile.country' || step.mapsTo === 'profile.city') {
          applyLocaleFromProfile()
        }
      }
      if (step.type === 'single_select' && typeof rawAnswer === 'string') {
        applyMapsTo(step.mapsTo, rawAnswer, updateProfile, updateSettings)
      }
      if (step.type === 'number' && step.mapsTo === 'onboarding.housingMonthly') {
        /* stored in answers only */
      }

      const nextIndex = index + 1

      if (step.id === 'pre_plan') {
        persistAnswers(nextAnswers, index)
        await requestPlans(nextAnswers)
        return
      }

      persistAnswers(nextAnswers, nextIndex)
      setIndex(nextIndex)
    },
    [answers, index, persistAnswers, requestPlans, setIndex, step, updateProfile, updateSettings]
  )

  const storeSnap = useFinanceStore.getState

  const goBack = useCallback(() => {
    if (phase !== 'survey') return
    if (index <= 0) return
    const prev = index - 1
    setIndex(prev)
    setOnboardingState({ currentStepIndex: prev })
  }, [phase, index, setIndex, setOnboardingState])

  const canGoBack = phase === 'survey' && index > 0

  return {
    answersReady,
    step,
    phase,
    index,
    surveyTotal,
    isLastSurveyStep,
    finishing,
    planLoading,
    loadError,
    handleStepContinue,
    finishOnboarding,
    plans,
    valNotes,
    storeSnap,
    profile,
    settings,
    answers,
    redo,
    router,
    goBack,
    canGoBack,
  }
}
