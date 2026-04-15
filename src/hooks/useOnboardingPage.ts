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
  const budgetPlans = useFinanceStore((s) => s.budgetPlans)
  const activeBudgetPlanId = useFinanceStore((s) => s.activeBudgetPlanId)
  const addBudgetPlan = useFinanceStore((s) => s.addBudgetPlan)

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
      // kind === 'live' stores no answer; the panel already persisted via the store.

      const isLiveStep =
        step.type === 'subscriptions_detail' ||
        step.type === 'goals_detail' ||
        step.type === 'savings_detail'
      const nextAnswers =
        step.type === 'static' || isLiveStep ? answers : { ...answers, [step.id]: rawAnswer }

      if (step.type === 'text' && typeof rawAnswer === 'string') {
        applyMapsTo(step.mapsTo, rawAnswer, updateProfile, updateSettings)
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

      // Final survey step → hand off to Buddgy.
      if (step.id === 'pre_plan') {
        persistAnswers(nextAnswers, index)
        setPhase('buddgy')
        return
      }

      const nextIndex = index + 1
      persistAnswers(nextAnswers, nextIndex)
      setIndex(nextIndex)
    },
    [answers, index, persistAnswers, setIndex, setPhase, step, updateProfile, updateSettings]
  )

  const storeSnap = useFinanceStore.getState

  const goBack = useCallback(() => {
    if (phase === 'buddgy') {
      setPhase('survey')
      return
    }
    if (index <= 0) return
    const prev = index - 1
    setIndex(prev)
    setOnboardingState({ currentStepIndex: prev })
  }, [phase, index, setIndex, setOnboardingState, setPhase])

  const canGoBack = phase === 'buddgy' || (phase === 'survey' && index > 0)

  /** Ensure there's a plan row Buddgy can write to before mounting BuddgyBuilderFlow. */
  const ensureBuddgyPlanId = useCallback((): string => {
    if (activeBudgetPlanId) return activeBudgetPlanId
    if (budgetPlans.length > 0) return budgetPlans[0].id
    return addBudgetPlan('Primary plan')
  }, [activeBudgetPlanId, budgetPlans, addBudgetPlan])

  return {
    answersReady,
    step,
    phase,
    index,
    surveyTotal,
    isLastSurveyStep,
    finishing,
    loadError,
    handleStepContinue,
    finishOnboarding,
    storeSnap,
    profile,
    answers,
    redo,
    router,
    goBack,
    canGoBack,
    ensureBuddgyPlanId,
  }
}
