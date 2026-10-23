'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { createClient } from '@/lib/supabase/client'

export interface NetWorthTrend {
  points: number[]
  pct: number
  dir: 'up' | 'down'
}

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
  const [trend, setTrend] = useState<NetWorthTrend | null>(null)
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
      if (cancelled || !data || data.length < 2) return
      const points = data.map((r) => Number(r.net_worth))
      const first = points[0]
      const last = points[points.length - 1]
      setTrend({ points, pct: first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100, dir: last >= first ? 'up' : 'down' })
    }, SETTLE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [userId, ready, netWorth, currency, basis])

  return trend
}
