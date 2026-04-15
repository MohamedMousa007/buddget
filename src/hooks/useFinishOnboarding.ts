'use client'

import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyPaymentDrafts, valueForPaymentStep } from '@/lib/onboarding/onboardingPageHelpers'

/**
 * Finalises the onboarding flow:
 *  - Applies any payment-method drafts the user entered.
 *  - Marks `onboardingState.planAccepted` + `currentStepIndex` so middleware allows /.
 *  - Updates the user profile row (onboarding_completed) + auth metadata in Supabase.
 *  - Navigates home.
 *
 * Buddgy's `applied` step is what writes the budget plan categories, so this hook no
 * longer takes a plan argument — it only wraps the "mark complete and ship the user out"
 * side-effect.
 */
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
  const setOnboardingState = useFinanceStore((s) => s.setOnboardingState)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  const finishOnboarding = useCallback(async () => {
    setFinishing(true)
    try {
      const base = useFinanceStore.getState().settings.baseCurrency
      updateSettings({ dismissOnboardingBanner: false })

      const drafts = valueForPaymentStep(answers)
      if (drafts.length > 0) {
        applyPaymentDrafts(redo, drafts, base)
      }

      setOnboardingState({
        planAccepted: true,
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
  }, [answers, redo, router, setOnboardingState, stepsLength, supabase, updateSettings])

  return { finishOnboarding, finishing }
}
