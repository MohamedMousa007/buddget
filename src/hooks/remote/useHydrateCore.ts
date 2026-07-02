'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { profileFromRow } from '@/lib/supabase/remote/mappers/profileMapper'
import { settingsFromRow } from '@/lib/supabase/remote/mappers/settingsMapper'
import { paymentMethodFromRow } from '@/lib/supabase/remote/mappers/paymentMethodMapper'

/**
 * Core hydration needed by every page: profiles, user_settings, payment_methods.
 * Called alongside any page-specific hydrate hooks. Side-effect only — pages
 * read the store via `useFinanceStore` selectors.
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
        const [profileR, settingsR, pmR] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
          supabase.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
          supabase.from('payment_methods').select('*').eq('user_id', uid).is('deleted_at', null),
        ])
        if (cancelled) return

        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (profileR.data) {
          const { profile, extras } = profileFromRow(profileR.data)
          patch.profile = profile
          patch.financialGoalsNotes = extras.financialGoalsNotes
          patch.activeBudgetPlanId = extras.activeBudgetPlanId
          if (settingsR.data) {
            patch.settings = settingsFromRow(settingsR.data, {
              baseCurrency: extras.baseCurrency,
              secondaryCurrency: extras.secondaryCurrency ?? null,
            })
          }
        }
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
