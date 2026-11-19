'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { hasPulled, subscribePulled } from '@/hooks/remote/hydrateGuard'
import { seedSystemCash } from '@/lib/accounts/actions'

/** Seeds the user's system Cash once the server's data is merged, so a stale cache never looks like a missing Cash. */
export function useEnsureSystemCash() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  const userId = useFinanceStore((s) => s.profile.id)
  const pulled = useSyncExternalStore(subscribePulled, () => (userId ? hasPulled(userId) : false), () => false)

  useEffect(() => {
    if (dataReady && pulled) seedSystemCash()
  }, [dataReady, pulled])
}
