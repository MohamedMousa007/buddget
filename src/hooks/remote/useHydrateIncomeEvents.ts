'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { incomeEventFromRow } from '@/lib/supabase/remote/mappers/incomeEventMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'
import { mergeById } from '@/hooks/remote/mergeById'

export function useHydrateIncomeEvents(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'incomeEvents')) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const res = await supabase.from('income_events').select('*').eq('user_id', uid).is('deleted_at', null)
        if (cancelled) return
        if (res.data) {
          const server = res.data.map(incomeEventFromRow)
          const local = useFinanceStore.getState().incomeEvents
          useFinanceStore.setState({ incomeEvents: mergeById(local, server) })
        }
        markHydrated(uid, 'incomeEvents')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateIncomeEvents]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
