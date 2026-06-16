'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { recurringExpenseFromRow } from '@/lib/supabase/remote/mappers/recurringExpenseMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'
import { mergeById } from '@/hooks/remote/mergeById'

/**
 * Hydrates `expenses` + `recurringExpenses` slices from Supabase. Runs at
 * most once per sign-in (tracked by the session guard) so page navigation
 * doesn't re-fetch and overwrite pending local edits.
 */
export function useHydrateExpenses(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'expenses')) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [expR, recR] = await Promise.all([
          supabase.from('expenses').select('*').eq('user_id', uid).is('deleted_at', null),
          supabase.from('recurring_expenses').select('*').eq('user_id', uid).is('deleted_at', null),
        ])
        if (cancelled) return
        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        const state = useFinanceStore.getState()
        if (expR.data) patch.expenses = mergeById(state.expenses, expR.data.map(expenseFromRow))
        if (recR.data) {
          patch.recurringExpenses = mergeById(state.recurringExpenses, recR.data.map(recurringExpenseFromRow))
        }
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
        markHydrated(uid, 'expenses')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateExpenses]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
