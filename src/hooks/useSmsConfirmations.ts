'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
}

export function useSmsConfirmations() {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const [pending, setPending] = useState<PendingConfirmation[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    void createClient()
      .from('sms_parse_log')
      .select('id, kind, clean_title, merchant, amount, currency, bank_name, account_last4, received_at')
      .eq('parsed_ok', true)
      .eq('awaiting_confirmation', true)
      .gte('created_at', since)
      .order('received_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setPending((data as PendingConfirmation[]) ?? []))
  }, [smsEnabled])

  const confirmItem = useCallback(async (logId: string) => {
    try {
      await fetch('/api/sms/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      })
      setPending((p) => p.filter((r) => r.id !== logId))
    } catch {
      // non-fatal
    }
  }, [])

  const dismissItem = useCallback(async (logId: string) => {
    try {
      await createClient()
        .from('sms_parse_log')
        .update({ awaiting_confirmation: false })
        .eq('id', logId)
      setPending((p) => p.filter((r) => r.id !== logId))
    } catch {
      // non-fatal
    }
  }, [])

  return { pending, confirmItem, dismissItem }
}
