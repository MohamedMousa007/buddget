'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { assembleBudgetPlan } from '@/lib/supabase/remote/mappers/budgetPlanMapper'

export function useHydrateBudget(): { loading: boolean } {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    setLoading(true)
    const supabase = createClient()
    void Promise.all([
      supabase.from('budget_plans').select('*').eq('user_id', uid),
      supabase.from('budget_categories').select('*').eq('user_id', uid),
      supabase.from('budget_subcategories').select('*').eq('user_id', uid),
    ])
      .then(([pR, cR, scR]) => {
        if (!pR.data) return
        const plans = pR.data.map((plan) =>
          assembleBudgetPlan({
            plan,
            categories: cR.data ?? [],
            subcategories: scR.data ?? [],
          })
        )
        useFinanceStore.setState({ budgetPlans: plans })
      })
      .catch((e) => console.error('[useHydrateBudget]', e))
      .finally(() => setLoading(false))
  }, [user?.id])

  return { loading }
}
