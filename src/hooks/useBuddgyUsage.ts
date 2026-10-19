'use client'

import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiBase'
import type { UsageStatus } from '@/lib/buddgy/client/usage'

/** The chat's usage, re-read whenever `refreshKey` changes (a turn finished, a new chat began). */
export function useBuddgyUsage(refreshKey: string): UsageStatus | null {
  const [status, setStatus] = useState<UsageStatus | null>(null)
  useEffect(() => {
    let live = true
    apiFetchAuth('/api/buddgy/usage')
      .then((r) => (r.ok ? (r.json() as Promise<UsageStatus>) : null))
      .then((s) => live && s && setStatus(s))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [refreshKey])
  return status
}
