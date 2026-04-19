'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { subscriptionFromRow } from '@/lib/supabase/remote/mappers/subscriptionMapper'
import { hasHydrated, markHydrated } from '@/hooks/remote/hydrateGuard'

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
        const res = await supabase.from('subscriptions').select('*').eq('user_id', uid)
        if (cancelled) return
        if (res.data) useFinanceStore.setState({ subscriptions: res.data.map(subscriptionFromRow) })
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
