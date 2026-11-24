'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { createClient } from '@/lib/supabase/client'
import { dailySnapshotDue, snapshotDay, snapshotStampKey } from '@/lib/savings/netWorthSnapshot'

const SETTLE_MS = 3000

/**
 * Saves today's net worth to `net_worth_snapshots` once a day, from any screen, when `ready` says the figure is complete.
 * One upsert on the table's own (user, day) key, so the Wealth page's own write the same day replaces it, never doubles it.
 * `onWritten` fires after the row is saved, so the caller can stop computing.
 */
export function useDailyNetWorthSnapshot(netWorth: number, currency: string, ready: boolean, basis: 'legacy' | 'accounts', onWritten?: () => void): void {
  const { user } = useAuth()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    const today = snapshotDay(new Date())
    const stamp = snapshotStampKey(userId, currency)
    let lastDay: string | null = null
    try { lastDay = window.localStorage.getItem(stamp) } catch { /* storage unavailable: the write below is still one per mount */ }
    if (!dailySnapshotDue({ ready, netWorth, lastDay, today })) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const { error } = await createClient()
        .from('net_worth_snapshots')
        .upsert({ user_id: userId, day: today, net_worth: netWorth, currency, basis }, { onConflict: 'user_id,day' })
      if (error || cancelled) return
      try { window.localStorage.setItem(stamp, today) } catch { /* ignore */ }
      onWritten?.()
    }, SETTLE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [userId, ready, netWorth, currency, basis, onWritten])
}
