'use client'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  detectRecurringCharges,
  type ChargeRow,
  type DetectedSubscription,
} from '@/lib/subscriptions/detectRecurringCharges'

export type { DetectedSubscription }

const LOOKBACK_DAYS = 90

/** Recurring charges at a catalog brand the user does NOT already track (see {@link detectRecurringCharges}). */
export function useSubscriptionDetector(): DetectedSubscription[] {
  const { smsEnabled, subscriptions } = useFinanceStore(
    useShallow((s) => ({
      smsEnabled: s.settings.smsTrackingEnabled,
      subscriptions: s.subscriptions,
    })),
  )
  const [detected, setDetected] = useState<DetectedSubscription[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    void createClient()
      .from('sms_parse_log')
      .select('merchant, merchant_normalized, clean_title, amount, currency, day')
      .eq('parsed_ok', true)
      .in('kind', ['purchase', 'online_purchase'])
      .gte('created_at', since)
      // Ascending so the last row is genuinely the LATEST sighting, not arbitrary DB order.
      .order('day', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        // Already tracked — including cancelled, so a cancelled sub isn't re-suggested.
        const tracked = new Set(subscriptions.map((s) => s.brandKey))
        setDetected(detectRecurringCharges(data as ChargeRow[], tracked))
      })
  }, [smsEnabled, subscriptions])

  return detected
}
