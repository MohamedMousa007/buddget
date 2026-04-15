'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { recurringExpenseFromRow } from '@/lib/supabase/remote/mappers/recurringExpenseMapper'

/**
 * Hydrates `expenses` + `recurringExpenses` slices from Supabase. Side-effect only.
 */
export function useHydrateExpenses(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [expR, recR] = await Promise.all([
          supabase.from('expenses').select('*').eq('user_id', uid),
          supabase.from('recurring_expenses').select('*').eq('user_id', uid),
        ])
        if (cancelled) return
        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (expR.data) patch.expenses = expR.data.map(expenseFromRow)
        if (recR.data) patch.recurringExpenses = recR.data.map(recurringExpenseFromRow)
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
      } catch (e) {
        if (!cancelled) console.error('[useHydrateExpenses]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
