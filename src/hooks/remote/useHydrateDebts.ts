'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { debtFromRow } from '@/lib/supabase/remote/mappers/debtMapper'
import { debtPaymentFromRow } from '@/lib/supabase/remote/mappers/debtPaymentMapper'
import { recurringDebtPaymentFromRow } from '@/lib/supabase/remote/mappers/recurringDebtPaymentMapper'

export function useHydrateDebts(): { loading: boolean } {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    setLoading(true)
    const supabase = createClient()
    void Promise.all([
      supabase.from('debts').select('*').eq('user_id', uid),
      supabase.from('debt_payments').select('*').eq('user_id', uid),
      supabase.from('recurring_debt_payments').select('*').eq('user_id', uid),
    ])
      .then(([dR, pR, rR]) => {
        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (dR.data) patch.debts = dR.data.map(debtFromRow)
        if (pR.data) patch.debtPayments = pR.data.map(debtPaymentFromRow)
        if (rR.data) patch.recurringDebtPayments = rR.data.map(recurringDebtPaymentFromRow)
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
      })
      .catch((e) => console.error('[useHydrateDebts]', e))
      .finally(() => setLoading(false))
  }, [user?.id])

  return { loading }
}
