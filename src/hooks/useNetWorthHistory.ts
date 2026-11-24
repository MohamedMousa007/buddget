'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { createClient } from '@/lib/supabase/client'
import type { NetWorthBasis } from '@/lib/savings/netWorth'
import { monthlyPoints, projectNetWorth, type NetWorthPath } from '@/lib/insights/netWorthPath'

const DAYS = 400

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
    void createClient()
      .from('net_worth_snapshots')
      .select('day, net_worth')
      .eq('currency', currency)
      .eq('basis', basis)
      .gte('day', isoDay(since))
      .order('day', { ascending: true })
      .limit(450)
      .then(({ data }) => {
        if (!cancelled) setLoaded({ key, path: projectNetWorth(monthlyPoints(data ?? [])) })
      })
    return () => { cancelled = true }
  }, [userId, currency, basis, enabled, key])

  return loaded?.key === key ? loaded.path : null
}
