'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/auth-context'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export interface OwnTransferRow {
  id: string
  amount: number | null
  currency: string | null
  received_at: string
  own_transfer_verdict: string | null
}

const LOOKBACK_DAYS = 30

/** Splits the outgoing-leg rows into pairs still waiting on the user and pairs the server already settled. */
export function splitOwnTransferRows(rows: OwnTransferRow[]): { asks: OwnTransferRow[]; settled: OwnTransferRow[] } {
  return {
    asks: rows.filter((r) => r.own_transfer_verdict === 'ask'),
    settled: rows.filter((r) => r.own_transfer_verdict === 'settle'),
  }
}

/** The user's own-transfer pairs of the last 30 days, listed once each from the outgoing leg, newest first. */
export function useOwnTransferReview() {
  const { user } = useAuth()
  const { online } = useNetworkStatus()
  const userId = user?.id ?? null
  const [rows, setRows] = useState<OwnTransferRow[]>([])

  const load = useCallback(async (): Promise<OwnTransferRow[] | null> => {
    if (!userId || !online) return null
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await createClient()
        .from('sms_parse_log')
        .select('id, amount, currency, received_at, own_transfer_verdict')
        .in('own_transfer_verdict', ['ask', 'settle'])
        .not('expense_id', 'is', null)
        .gte('received_at', since)
        .order('received_at', { ascending: false })
        .limit(20)
      return (data as OwnTransferRow[] | null) ?? []
    } catch {
      return []
    }
  }, [userId, online])

  useEffect(() => {
    void load().then((r) => r && setRows(r))
  }, [load])

  const refresh = useCallback(async () => {
    const r = await load()
    if (r) setRows(r)
  }, [load])

  return { ...splitOwnTransferRows(rows), refresh }
}
