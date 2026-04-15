'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { assembleBudgetPlan } from '@/lib/supabase/remote/mappers/budgetPlanMapper'

export function useHydrateBudget(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [pR, cR, scR] = await Promise.all([
          supabase.from('budget_plans').select('*').eq('user_id', uid),
          supabase.from('budget_categories').select('*').eq('user_id', uid),
          supabase.from('budget_subcategories').select('*').eq('user_id', uid),
        ])
        if (cancelled) return
        if (!pR.data) return
        const plans = pR.data.map((plan) =>
          assembleBudgetPlan({
            plan,
            categories: cR.data ?? [],
            subcategories: scR.data ?? [],
          })
        )
        useFinanceStore.setState({ budgetPlans: plans })
      } catch (e) {
        if (!cancelled) console.error('[useHydrateBudget]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
