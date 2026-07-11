'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { assembleBudgetPlan } from '@/lib/supabase/remote/mappers/budgetPlanMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'
import { mergeById, type MergableRow } from '@/hooks/remote/mergeById'

export function useHydrateBudget(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'budget')) return
    // Warm cache already holds this user's data — skip the redundant refetch.
    if (useFinanceStore.getState().profile.id === uid) { markHydrated(uid, 'budget'); return }
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [pR, cR, scR] = await Promise.all([
          supabase.from('budget_plans').select('*').eq('user_id', uid).is('deleted_at', null),
          supabase.from('budget_categories').select('*').eq('user_id', uid).is('deleted_at', null),
          supabase.from('budget_subcategories').select('*').eq('user_id', uid).is('deleted_at', null),
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
        const local = useFinanceStore.getState().budgetPlans
        useFinanceStore.setState({
          budgetPlans: mergeById(local as unknown as MergableRow[], plans as unknown as MergableRow[]) as typeof local,
        })
        markHydrated(uid, 'budget')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateBudget]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
