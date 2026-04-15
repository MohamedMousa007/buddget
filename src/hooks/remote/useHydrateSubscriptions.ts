'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { subscriptionFromRow } from '@/lib/supabase/remote/mappers/subscriptionMapper'

export function useHydrateSubscriptions(): { loading: boolean } {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await createClient().from('subscriptions').select('*').eq('user_id', uid)
        if (res.data) useFinanceStore.setState({ subscriptions: res.data.map(subscriptionFromRow) })
      } catch (e) {
        console.error('[useHydrateSubscriptions]', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  return { loading }
}
