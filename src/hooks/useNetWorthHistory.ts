'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import type { NetWorthBasis } from '@/lib/savings/netWorth'
import { monthlyPoints, projectNetWorth, type NetWorthPath } from '@/lib/insights/netWorthPath'

const DAYS = 400

type SnapshotRow = { day: string; net_worth: number }

/**
 * The saved snapshots for one currency and basis since a day, or [] when they cannot be read. Never throws: it runs
 * from an effect, and a throw there (no Supabase env, a client that fails to build, a network reject) took down the
 * whole Insights page for a member with too little data to have a net worth gap (the learning state).
 */
export async function fetchNetWorthSnapshots(currency: string, basis: NetWorthBasis, since: string): Promise<SnapshotRow[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await createClient()
      .from('net_worth_snapshots')
      .select('day, net_worth')
      .eq('currency', currency)
      .eq('basis', basis)
      .gte('day', since)
      .order('day', { ascending: true })
      .limit(450)
    return (data as SnapshotRow[] | null) ?? []
  } catch {
    return []
  }
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * A read-only look at the saved net worth snapshots, one currency and basis, bounded by user (RLS), day range and
 * LIMIT, then a 12-month "at this rate" line. Writing stays with the Wealth page, which knows when the figure is complete.
 */
export function useNetWorthPath(currency: string, basis: NetWorthBasis, enabled: boolean): NetWorthPath | null {
  const { user } = useAuth()
  const userId = user?.id
  const key = `${userId}:${currency}:${basis}`
  const [loaded, setLoaded] = useState<{ key: string; path: NetWorthPath | null } | null>(null)

  useEffect(() => {
    if (!userId || !enabled) return
    let cancelled = false
    const since = new Date(Date.now() - DAYS * 86_400_000)
    void fetchNetWorthSnapshots(currency, basis, isoDay(since)).then((rows) => {
      if (!cancelled) setLoaded({ key, path: projectNetWorth(monthlyPoints(rows)) })
    })
    return () => { cancelled = true }
  }, [userId, currency, basis, enabled, key])

  return loaded?.key === key ? loaded.path : null
}
