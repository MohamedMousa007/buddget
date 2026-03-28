'use client'

import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { OnboardingAiPlan } from '@/lib/store/types'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { applyPaymentDrafts, valueForPaymentStep } from '@/lib/onboarding/onboardingPageHelpers'
import { ONBOARDING_PLAN_DISPLAY_CATEGORIES } from '@/lib/onboarding/planPickerCopy'

export function useFinishOnboarding({
  answers,
  redo,
  router,
  stepsLength,
  supabase,
}: {
  answers: Record<string, unknown>
  redo: boolean
  router: { refresh: () => void; replace: (href: string) => void }
  stepsLength: number
  supabase: SupabaseClient
}) {
  const [finishing, setFinishing] = useState(false)
  const setBudgetCategories = useFinanceStore((s) => s.setBudgetCategories)
  const setOnboardingState = useFinanceStore((s) => s.setOnboardingState)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  const finishOnboarding = useCallback(
    async (plan: OnboardingAiPlan | null) => {
      setFinishing(true)
      try {
        const base = useFinanceStore.getState().settings.baseCurrency
        const monthly = calculateMonthlyIncome(
          useFinanceStore.getState().incomeSources,
          base,
          useFinanceStore.getState().exchangeRates
        )

        if (plan) {
          const p = plan.percents
          setBudgetCategories(
            ONBOARDING_PLAN_DISPLAY_CATEGORIES.map((category) => ({
              category,
              budgetedAmount: monthly > 0 ? (p[category] / 100) * monthly : 0,
              currency: base,
              percentOfIncome: p[category],
            }))
          )
          updateSettings({ budgetEntryMode: 'percent_of_income', dismissOnboardingBanner: false })
        } else {
          updateSettings({ dismissOnboardingBanner: false })
        }

        const drafts = valueForPaymentStep(answers)
        if (drafts.length > 0) {
          applyPaymentDrafts(redo, drafts, base)
        }

        setOnboardingState({
          planAccepted: true,
          selectedPlanIndex: plan ? 0 : null,
          currentStepIndex: stepsLength,
        })

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user && !redo) {
          await supabase
            .from('user_profiles')
            .update({
              onboarding_completed: true,
              display_name: useFinanceStore.getState().profile.name,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)

          await supabase.auth.updateUser({
            data: { onboarding_completed: true },
          })
        }

        router.refresh()
        router.replace('/')
      } finally {
        setFinishing(false)
      }
    },
    [answers, redo, router, setBudgetCategories, setOnboardingState, stepsLength, supabase, updateSettings]
  )

  return { finishOnboarding, finishing }
}
