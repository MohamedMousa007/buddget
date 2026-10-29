'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { createClient } from '@/lib/supabase/client'
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
export function useNetWorthTrend(netWorth: number, currency: string, ready: boolean, basis: 'legacy' | 'accounts' = 'legacy'): NetWorthTrend | null {
  const { user } = useAuth()
  // Keyed by currency and basis: a trend read for another one is never shown.
  const [loaded, setLoaded] = useState<{ key: string; trend: NetWorthTrend | null } | null>(null)
  const key = `${currency}:${basis}`
  const userId = user?.id

  useEffect(() => {
    if (!userId || !ready || !Number.isFinite(netWorth)) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const now = new Date()
      const since = new Date(now.getTime() - DAYS * 86_400_000)
      // Written only when today's figure actually changed: the same value is not sent again on every visit or edit.
      const stamp = `bdg-nw:${userId}:${isoDay(now)}:${currency}:${basis}`
      const rounded = netWorth.toFixed(2)
      let already = false
      try { already = window.localStorage.getItem(stamp) === rounded } catch { /* storage unavailable: write */ }
      if (!already) {
        const { error } = await supabase
          .from('net_worth_snapshots')
          .upsert({ user_id: userId, day: isoDay(now), net_worth: netWorth, currency, basis }, { onConflict: 'user_id,day' })
        if (!error) {
          try { window.localStorage.setItem(stamp, rounded) } catch { /* ignore */ }
        }
      }
      const { data } = await supabase
        .from('net_worth_snapshots')
        .select('day, net_worth')
        .eq('currency', currency)
        .eq('basis', basis)
        .gte('day', isoDay(since))
        .order('day', { ascending: true })
      if (cancelled) return
      setLoaded({ key, trend: buildNetWorthTrend(data) })
    }, SETTLE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [userId, ready, netWorth, currency, basis, key])

  return loaded?.key === key ? loaded.trend : null
}
