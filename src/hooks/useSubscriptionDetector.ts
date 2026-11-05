'use client'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createClient } from '@/lib/supabase/client'
import { sharedFetch } from '@/lib/query/sharedFetch'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  detectRecurringCharges,
  type ChargeRow,
  type DetectedSubscription,
} from '@/lib/subscriptions/detectRecurringCharges'
import { buildSmsFinds, cancelledBrandKeys, type SmsFind } from '@/lib/subscriptions/smsFinds'

export type { DetectedSubscription, SmsFind }

const LOOKBACK_DAYS = 90

export interface SubscriptionDetection {
  finds: SmsFind[]
  /** Messages read in the lookback window. */
  scanned: number
}

/**
 * Recurring SMS charges worth a review: new brands to add, and manual subscriptions to link
 * (see {@link buildSmsFinds}). Reads the parse log once per change of tracked subscriptions.
 */
export function useSubscriptionDetector(): SubscriptionDetection {
  const { smsEnabled, subscriptions, expenses } = useFinanceStore(
    useShallow((s) => ({
      smsEnabled: s.settings.smsTrackingEnabled,
      subscriptions: s.subscriptions,
      expenses: s.expenses,
    })),
  )
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
  const [rows, setRows] = useState<ChargeRow[]>([])
  const [scanned, setScanned] = useState(0)

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    void sharedFetch('sms-charges', 60_000, async () => {
      const { data } = await createClient()
        .from('sms_parse_log')
        .select('merchant, merchant_normalized, clean_title, amount, currency, received_at, created_at, raw_sms_summary')
        .eq('parsed_ok', true)
        .in('kind', ['purchase', 'online_purchase'])
        .gte('created_at', since)
        // Ascending so the last row is genuinely the LATEST sighting, not arbitrary DB order.
        .order('received_at', { ascending: true })
      return data
    }).then((data) => {
      if (!data) return
      setRows(data.map((r) => ({ ...r, day: (r.received_at ?? r.created_at)?.slice(0, 10) ?? null })) as ChargeRow[])
      setScanned(data.length)
    }).catch(() => undefined)
  }, [smsEnabled])

  return useMemo(() => {
    const detected = detectRecurringCharges(rows, cancelledBrandKeys(subscriptions))
    return { finds: buildSmsFinds(detected, subscriptions, expenses, new Set(dismissed)), scanned }
  }, [rows, scanned, subscriptions, expenses, dismissed])
}
