'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { createClient } from '@/lib/supabase/client'
import { useUsageStore } from '@/lib/usage/usageStore'

export interface BalanceViewData {
  balance: number
  currency: string
  reportedAt: string
  /** The month's count after this view, and the limit (null = unlimited). */
  used: number
  limit: number | null
}

interface Row { balance: number; currency: string; reported_at: string }
interface Result { status: 'ok' | 'empty' | 'limit' | 'not_found'; used?: number; limit?: number | null; reports?: Row[] }

/**
 * Opening one account's live balance card is one view (Free: 10 a month). The server counts it, only when it really shows a bank
 * balance, and a second open of the same account within 24 hours is free. A refused view queues the limit sheet; offline shows nothing.
 */
export function useBalanceView(accountId: string, open: boolean, isCash: boolean): { data: BalanceViewData | null; blocked: boolean } {
  const { online } = useNetworkStatus()
  const on = useBillingStore((s) => billingOn(s.me))
  const [data, setData] = useState<BalanceViewData | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (!open || isCash || !online) return
    let live = true
    void createClient().rpc('balance_view', { p_payment_method: accountId }).then(({ data: res }) => {
      const r = res as unknown as Result | null
      if (!live || !r) return
      if (r.status === 'limit') {
        setBlocked(true)
        if (on) {
          useUsageStore.getState().push({ type: 'views_open' })
          void useBillingStore.getState().refresh()
        }
        return
      }
      const latest = r.reports?.[0]
      if (r.status !== 'ok' || !latest) return
      setBlocked(false)
      setData({ balance: Number(latest.balance), currency: latest.currency, reportedAt: latest.reported_at, used: r.used ?? 0, limit: r.limit ?? null })
      if (on) void useBillingStore.getState().refresh()
    })
    return () => { live = false }
  }, [open, accountId, isCash, online, on])

  return { data, blocked }
}
