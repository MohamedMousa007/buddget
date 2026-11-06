'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { hasHydrated } from '@/hooks/remote/hydrateGuard'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const TICK_MS = 60_000

/**
 * Writes the charges of log-mode subscriptions that came due, for as long as the app is open: at boot, when a
 * day rolls over, and once expenses have hydrated (otherwise every cycle looks unpaid and gets logged twice).
 * Cycles missed while the app was closed are caught up by the store action, bounded to the last three.
 */
export function useLogDueSubscriptions() {
  const { user } = useAuth()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const uid = user?.id
  useEffect(() => {
    if (!dataReady) return
    const tick = () => {
      if (uid && !hasHydrated(uid, 'expenses')) return
      useFinanceStore.getState().logDueSubscriptions()
    }
    tick()
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [dataReady, uid])
}
