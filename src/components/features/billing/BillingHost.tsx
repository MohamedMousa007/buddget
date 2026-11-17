'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { NoticeHost } from '@/components/features/usage/NoticeHost'
import { WeekCheckSheet } from '@/components/features/billing/WeekCheckSheet'
import { useWeekCheckStore } from '@/lib/loyalty/weekCheckStore'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { startBillingSession } from '@/lib/billing/billingSession'
import { stopPurchases } from '@/lib/billing/purchases'
import { redeemRememberedInvite } from '@/components/features/invite/inviteCode'
import { BUDDGY_LOOK_ATTR } from '@/components/features/rewards/cosmetics'
import { isNative } from '@/lib/native/isNative'
import { redeemInviteCode } from '@/lib/referrals/referralsApi'

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

  // A code from an invite link or the sign-up field is redeemed once the account exists; the server decides whether it counts.
  useEffect(() => {
    if (!userId || !enabled) return
    let live = true
    void (async () => {
      const deviceId = isNative() ? await import('@/lib/native/deviceId').then((m) => m.getOrCreateDeviceId()).catch(() => null) : null
      if (live && (await redeemRememberedInvite(redeemInviteCode, deviceId)) === 'ok') await refresh()
    })()
    return () => { live = false }
  }, [userId, enabled, refresh])

  // The chosen Buddgy look is published on <html> for the Buddgy face to style against.
  const look = useBillingStore((s) => s.me?.rewards?.cosmetics.buddgyLook)
  useEffect(() => {
    if (look && look !== 'classic') document.documentElement.setAttribute(BUDDGY_LOOK_ATTR, look)
    else document.documentElement.removeAttribute(BUDDGY_LOOK_ATTR)
  }, [look])

  // The weekly check's figures, only while selling is on.
  useEffect(() => {
    if (userId && enabled) void loadWeek()
  }, [userId, enabled, loadWeek])

  return enabled ? <><NoticeHost /><WeekCheckSheet /></> : null
}
