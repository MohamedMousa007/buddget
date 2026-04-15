'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { profileFromRow } from '@/lib/supabase/remote/mappers/profileMapper'
import { settingsFromRow } from '@/lib/supabase/remote/mappers/settingsMapper'
import { onboardingFromRow } from '@/lib/supabase/remote/mappers/onboardingMapper'
import { paymentMethodFromRow } from '@/lib/supabase/remote/mappers/paymentMethodMapper'
import type { Currency } from '@/lib/store/types'

/**
 * Core hydration needed by every page: profiles, user_settings, onboarding_state,
 * payment_methods. Called alongside any page-specific hydrate hooks. Side-effect only
 * — pages read the store via `useFinanceStore` selectors.
 */
export function useHydrateCore(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [profileR, settingsR, onboardingR, pmR] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
          supabase.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
          supabase.from('onboarding_state').select('*').eq('user_id', uid).maybeSingle(),
          supabase.from('payment_methods').select('*').eq('user_id', uid),
        ])
        if (cancelled) return

        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (profileR.data) {
          const { profile, extras } = profileFromRow(profileR.data)
          patch.profile = profile
          patch.financialGoalsNotes = extras.financialGoalsNotes
          patch.activeBudgetPlanId = extras.activeBudgetPlanId
          const secondary = (profileR.data.secondary_currency ?? null) as Currency | null
          if (settingsR.data) {
            patch.settings = settingsFromRow(settingsR.data, {
              baseCurrency: profile.baseCurrency,
              secondaryCurrency: secondary,
            })
          }
        }
        if (onboardingR.data) patch.onboardingState = onboardingFromRow(onboardingR.data)
        if (pmR.data) patch.paymentMethods = pmR.data.map(paymentMethodFromRow)
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
      } catch (e) {
        if (!cancelled) console.error('[useHydrateCore]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
