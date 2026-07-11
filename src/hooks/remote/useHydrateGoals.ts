'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'
import { mergeById } from '@/hooks/remote/mergeById'

export function useHydrateGoals(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'goals')) return
    // Warm cache already holds this user's data — skip the redundant refetch.
    if (useFinanceStore.getState().profile.id === uid) { markHydrated(uid, 'goals'); return }
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const res = await supabase.from('goals').select('*').eq('user_id', uid).is('deleted_at', null)
        if (cancelled) return
        if (res.data) {
          const server = res.data.map(goalFromRow)
          const local = useFinanceStore.getState().goals
          useFinanceStore.setState({ goals: mergeById(local, server) })
        }
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
