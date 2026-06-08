'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'

export interface DetectedAccount {
  bankName: string | null
  last4: string
}

export function usePaymentMethodDetector(): DetectedAccount[] {
  const { smsEnabled, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      smsEnabled: s.settings.smsTrackingEnabled,
      paymentMethods: s.paymentMethods,
    })),
  )
  const [detected, setDetected] = useState<DetectedAccount[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    void createClient()
      .from('sms_parse_log')
      .select('account_last4, bank_name')
      .eq('parsed_ok', true)
      .not('account_last4', 'is', null)
      .gte('created_at', since)
      .then(({ data }) => {
        if (!data) return
        const linked = new Set(
          paymentMethods.filter((pm) => pm.last4).map((pm) => pm.last4!),
        )
        // Group by last4, pick most-frequent bank_name per group.
        const groups = new Map<string, Record<string, number>>()
        for (const row of data) {
          const l4 = row.account_last4!
          if (!groups.has(l4)) groups.set(l4, {})
          const key = row.bank_name ?? ''
          groups.get(l4)![key] = (groups.get(l4)![key] ?? 0) + 1
        }
        const result: DetectedAccount[] = []
        for (const [l4, counts] of groups) {
          if (linked.has(l4)) continue
          const bankName =
            Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
          result.push({ last4: l4, bankName: bankName || null })
        }
        setDetected(result)
      })
  }, [smsEnabled, paymentMethods])

  return detected
}
