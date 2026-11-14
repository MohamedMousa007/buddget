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
  counterparty_last4?: string | null
  paired_log_id?: string | null
}

const LOOKBACK_DAYS = 30

/**
 * Splits the rows into pairs still waiting on the user, pairs the server already settled, and single legs whose
 * counterparty digits may be the user's own account. Only a settled pair has an Undo; a one-leg yes has no partner.
 */
export function splitOwnTransferRows(rows: OwnTransferRow[]): { asks: OwnTransferRow[]; settled: OwnTransferRow[]; accountAsks: OwnTransferRow[] } {
  return {
    asks: rows.filter((r) => r.own_transfer_verdict === 'ask'),
    settled: rows.filter((r) => r.own_transfer_verdict === 'settle' && r.paired_log_id !== null),
    accountAsks: rows.filter((r) => r.own_transfer_verdict === 'ask_account'),
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
        .select('id, amount, currency, received_at, own_transfer_verdict, counterparty_last4, paired_log_id')
        // A pair is listed once, from its outgoing leg; a one-leg question has no pair and may sit on an income row.
        .or('and(own_transfer_verdict.in.(ask,settle),expense_id.not.is.null),own_transfer_verdict.eq.ask_account')
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
