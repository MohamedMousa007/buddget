'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { savingsAccountFromRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { savingsTransactionFromRow } from '@/lib/supabase/remote/mappers/savingsTransactionMapper'
import { savingsHoldingFromRow } from '@/lib/supabase/remote/mappers/savingsHoldingMapper'
import { recurringSavingsDepositFromRow } from '@/lib/supabase/remote/mappers/recurringSavingsDepositMapper'

export function useHydrateSavings(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [aR, tR, hR, rR] = await Promise.all([
          supabase.from('savings_accounts').select('*').eq('user_id', uid),
          supabase.from('savings_transactions').select('*').eq('user_id', uid),
          supabase.from('savings_holdings').select('*').eq('user_id', uid),
          supabase.from('recurring_savings_deposits').select('*').eq('user_id', uid),
        ])
        if (cancelled) return
        const patch: Partial<ReturnType<typeof useFinanceStore.getState>> = {}
        if (aR.data) patch.savingsAccounts = aR.data.map(savingsAccountFromRow)
        if (tR.data) patch.savingsTransactions = tR.data.map(savingsTransactionFromRow)
        if (hR.data) patch.savingsHoldings = hR.data.map(savingsHoldingFromRow)
        if (rR.data) patch.recurringSavingsDeposits = rR.data.map(recurringSavingsDepositFromRow)
        if (Object.keys(patch).length > 0) useFinanceStore.setState(patch)
      } catch (e) {
        if (!cancelled) console.error('[useHydrateSavings]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
