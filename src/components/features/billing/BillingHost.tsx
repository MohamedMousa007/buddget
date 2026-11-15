'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { PaywallSheet } from '@/components/features/billing/PaywallSheet'
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

  useEffect(() => {
    if (!userId) {
      reset()
      void stopPurchases()
      return
    }
    void refresh()
  }, [userId, refresh, reset])

  useEffect(() => {
    if (userId) void startBillingSession(userId, enabled)
  }, [userId, enabled])

  return enabled ? <PaywallSheet /> : null
}
