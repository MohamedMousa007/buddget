'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'

export function useHydrateGoals(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'goals')) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const res = await supabase.from('goals').select('*').eq('user_id', uid)
        if (cancelled) return
        if (res.data) useFinanceStore.setState({ goals: res.data.map(goalFromRow) })
        markHydrated(uid, 'goals')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateGoals]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
