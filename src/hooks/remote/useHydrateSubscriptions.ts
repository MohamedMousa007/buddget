'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { subscriptionFromRow } from '@/lib/supabase/remote/mappers/subscriptionMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'
import { mergeById, type MergableRow } from '@/hooks/remote/mergeById'

export function useHydrateSubscriptions(): void {
  const { user } = useAuth()

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    if (hasHydrated(uid, 'subscriptions')) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const res = await supabase.from('subscriptions').select('*').eq('user_id', uid).is('deleted_at', null)
        if (cancelled) return
        if (res.data) {
          const server = res.data.map(subscriptionFromRow)
          const local = useFinanceStore.getState().subscriptions
          useFinanceStore.setState({
            subscriptions: mergeById(local as unknown as MergableRow[], server as unknown as MergableRow[]) as typeof local,
          })
        }
        markHydrated(uid, 'subscriptions')
      } catch (e) {
        if (!cancelled) console.error('[useHydrateSubscriptions]', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
