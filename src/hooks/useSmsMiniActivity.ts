'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export interface SmsMiniItem {
  id: string
  kind: string | null
  clean_title: string | null
  merchant: string | null
  amount: number | null
  currency: string | null
  received_at: string
}

export function useSmsMiniActivity(): SmsMiniItem[] {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const [items, setItems] = useState<SmsMiniItem[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    void createClient()
      .from('sms_parse_log')
      .select('id, kind, clean_title, merchant, amount, currency, received_at')
      .eq('parsed_ok', true)
      .eq('awaiting_confirmation', false)
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setItems((data as SmsMiniItem[]) ?? []))
  }, [smsEnabled])

  return items
}
