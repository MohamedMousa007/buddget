'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { NoticeHost } from '@/components/features/usage/NoticeHost'
import { WeekCheckSheet } from '@/components/features/billing/WeekCheckSheet'
import { useWeekCheckStore } from '@/lib/loyalty/weekCheckStore'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { startBillingSession } from '@/lib/billing/billingSession'
import { stopPurchases } from '@/lib/billing/purchases'

/**
 * Loads the plan for the signed-in user and, only when the server's billing switch is on, starts the store SDK as that user
 * and claims the trial once. With the switch off it reads one endpoint and renders nothing.
 */
export function BillingHost() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const enabled = useBillingStore((s) => billingOn(s.me))
  const refresh = useBillingStore((s) => s.refresh)
  const reset = useBillingStore((s) => s.reset)
  const loadWeek = useWeekCheckStore((s) => s.load)
  const resetWeek = useWeekCheckStore((s) => s.reset)

  useEffect(() => {
    if (!userId) {
      reset()
      resetWeek()
      void stopPurchases()
      return
    }
    void refresh()
  }, [userId, refresh, reset, resetWeek])

  useEffect(() => {
    if (userId) void startBillingSession(userId, enabled)
  }, [userId, enabled])

  // The weekly check's figures, only while selling is on.
  useEffect(() => {
    if (userId && enabled) void loadWeek()
  }, [userId, enabled, loadWeek])

  return enabled ? <><NoticeHost /><WeekCheckSheet /></> : null
}
