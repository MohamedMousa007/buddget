'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'

export function useHydrateGoals(): { loading: boolean } {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await createClient().from('goals').select('*').eq('user_id', uid)
        if (res.data) useFinanceStore.setState({ goals: res.data.map(goalFromRow) })
      } catch (e) {
        console.error('[useHydrateGoals]', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  return { loading }
}
