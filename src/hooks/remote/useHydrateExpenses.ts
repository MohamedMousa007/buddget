'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { recurringExpenseFromRow } from '@/lib/supabase/remote/mappers/recurringExpenseMapper'

/**
 * Hydrates `expenses` + `recurringExpenses` slices from Supabase.
 * Zustand cache (via persist middleware) renders instantly with whatever was last
 * cached locally; this hook overlays the authoritative server data once it arrives.
 */
export function useHydrateExpenses(): { loading: boolean } {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    setLoading(true)
    const supabase = createClient()
    void Promise.all([
      supabase.from('expenses').select('*').eq('user_id', uid),
      supabase.from('recurring_expenses').select('*').eq('user_id', uid),
    ])
      .then(([expR, recR]) => {
        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (expR.data) patch.expenses = expR.data.map(expenseFromRow)
        if (recR.data) patch.recurringExpenses = recR.data.map(recurringExpenseFromRow)
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
      })
      .catch((e) => console.error('[useHydrateExpenses]', e))
      .finally(() => setLoading(false))
  }, [user?.id])

  return { loading }
}
