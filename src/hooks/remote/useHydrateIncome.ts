'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { incomeSourceFromRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'
import { mergeById } from '@/hooks/remote/mergeById'

export function useHydrateIncome(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'income')) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const res = await supabase.from('income_sources').select('*').eq('user_id', uid)
        if (cancelled) return
        if (res.data) {
          const server = res.data.map(incomeSourceFromRow)
          const local = useFinanceStore.getState().incomeSources
          useFinanceStore.setState({ incomeSources: mergeById(local, server) })
        }
        markHydrated(uid, 'income')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateIncome]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
