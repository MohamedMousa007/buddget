'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { incomeSourceFromRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'

export function useHydrateIncome(): { loading: boolean } {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await createClient().from('income_sources').select('*').eq('user_id', uid)
        if (res.data) useFinanceStore.setState({ incomeSources: res.data.map(incomeSourceFromRow) })
      } catch (e) {
        console.error('[useHydrateIncome]', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  return { loading }
}
