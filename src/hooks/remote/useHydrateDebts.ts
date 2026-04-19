'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { debtFromRow } from '@/lib/supabase/remote/mappers/debtMapper'
import { debtPaymentFromRow } from '@/lib/supabase/remote/mappers/debtPaymentMapper'
import { recurringDebtPaymentFromRow } from '@/lib/supabase/remote/mappers/recurringDebtPaymentMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'

export function useHydrateDebts(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'debts')) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [dR, pR, rR] = await Promise.all([
          supabase.from('debts').select('*').eq('user_id', uid),
          supabase.from('debt_payments').select('*').eq('user_id', uid),
          supabase.from('recurring_debt_payments').select('*').eq('user_id', uid),
        ])
        if (cancelled) return
        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (dR.data) patch.debts = dR.data.map(debtFromRow)
        if (pR.data) patch.debtPayments = pR.data.map(debtPaymentFromRow)
        if (rR.data) patch.recurringDebtPayments = rR.data.map(recurringDebtPaymentFromRow)
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
        markHydrated(uid, 'debts')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateDebts]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
