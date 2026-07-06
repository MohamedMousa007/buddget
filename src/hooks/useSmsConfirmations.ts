'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { confirmSmsLog, dismissSmsLog } from '@/lib/sms/confirmActions'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export interface PendingConfirmation {
  id: string
  kind: string | null
  clean_title: string | null
  merchant: string | null
  amount: number | null
  currency: string | null
  bank_name: string | null
  account_last4: string | null
  received_at: string
  /** 'currency_provisional' → transaction already exists; user confirms the currency. */
  failure_code: string | null
  expense_id: string | null
  income_id: string | null
}

function fetchPending() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return createClient()
    .from('sms_parse_log')
    .select('id, kind, clean_title, merchant, amount, currency, bank_name, account_last4, received_at, failure_code, expense_id, income_id')
    .eq('parsed_ok', true)
    .eq('awaiting_confirmation', true)
    .gte('created_at', since)
    .order('received_at', { ascending: false })
    .limit(20)
}

export function useSmsConfirmations() {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const [pending, setPending] = useState<PendingConfirmation[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    void fetchPending().then(({ data }) => setPending((data as PendingConfirmation[]) ?? []))
  }, [smsEnabled])

  const refetch = useCallback(async () => {
    if (!smsEnabled) return
    const { data } = await fetchPending()
    setPending((data as PendingConfirmation[]) ?? [])
  }, [smsEnabled])

  /** Resolves false when the server rejected the confirm — the item stays. */
  const confirmItem = useCallback(async (logId: string, currency?: string): Promise<boolean> => {
    const ok = await confirmSmsLog(logId, currency)
    if (ok) setPending((p) => p.filter((r) => r.id !== logId))
    return ok
  }, [])

  /** Resolves false when the update failed (network / RLS) — the item stays. */
  const dismissItem = useCallback(async (logId: string): Promise<boolean> => {
    const ok = await dismissSmsLog(logId)
    if (ok) setPending((p) => p.filter((r) => r.id !== logId))
    return ok
  }, [])

  return { pending, confirmItem, dismissItem, refetch }
}
