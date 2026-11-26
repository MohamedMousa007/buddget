'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { saveNetWorthSnapshot } from '@/hooks/useDailyNetWorthSnapshot'
import { fetchNetWorthSnapshots } from '@/hooks/useNetWorthHistory'
import type { NetWorthBasis } from '@/lib/savings/netWorth'
import { buildNetWorthTrend, type NetWorthTrend } from '@/lib/savings/netWorthTrend'

export type { NetWorthTrend }

const DAYS = 30
const SETTLE_MS = 2000

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Net worth has no history anywhere else, so today's figure is written to `net_worth_snapshots`
 * (one row per day) once it has settled, and the last 30 days are read back. Null until there
 * are two snapshots in the base currency — never a made-up trend.
 */
export function useNetWorthTrend(netWorth: number, currency: string, ready: boolean, basis: NetWorthBasis = 'assets'): NetWorthTrend | null {
  const { user } = useAuth()
  // Keyed by currency and basis: a trend read for another one is never shown.
  const [loaded, setLoaded] = useState<{ key: string; trend: NetWorthTrend | null } | null>(null)
  const key = `${currency}:${basis}`
  const userId = user?.id

  useEffect(() => {
    if (!userId || !ready || !Number.isFinite(netWorth)) return
    let cancelled = false
    // Never throws (no Supabase env, a client that fails to build, a network reject): the helpers below fail quietly.
    const timer = setTimeout(async () => {
      const now = new Date()
      const since = new Date(now.getTime() - DAYS * 86_400_000)
      // Written only when today's figure actually changed: the same value is not sent again on every visit or edit.
      const stamp = `bdg-nw:${userId}:${isoDay(now)}:${currency}:${basis}`
      const rounded = netWorth.toFixed(2)
      let already = false
      try { already = window.localStorage.getItem(stamp) === rounded } catch { /* storage unavailable: write */ }
      if (!already && await saveNetWorthSnapshot({ user_id: userId, day: isoDay(now), net_worth: netWorth, currency, basis })) {
        try { window.localStorage.setItem(stamp, rounded) } catch { /* ignore */ }
      }
      const rows = await fetchNetWorthSnapshots(currency, basis, isoDay(since))
      if (cancelled) return
      setLoaded({ key, trend: buildNetWorthTrend(rows) })
    }, SETTLE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [userId, ready, netWorth, currency, basis, key])

  return loaded?.key === key ? loaded.trend : null
}
