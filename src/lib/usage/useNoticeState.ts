'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useBillingStore, billingOn, type BillingMe } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import type { NoticeState } from '@/lib/usage/usageNotices'
import { useUsageStore } from '@/lib/usage/usageStore'

/** What the rules table reads, built from the plan the server reported and what this phone remembers. Null while selling is off or the plan is unknown. */
export function buildNoticeState(me: BillingMe | null, signals: NoticeState['signals'], offline: boolean, now: number): NoticeState | null {
  if (!me || !billingOn(me)) return null
  const view = subscriptionView(me, now)
  const u = me.usage
  const plan: NoticeState['plan'] = view.kind === 'trial' ? 'trial' : view.kind === 'expired' ? 'expired' : view.proActive ? 'pro' : 'free'
  const planLimit = u?.plans.limit ?? null
  return {
    plan,
    trialDay: view.trialDay,
    endedAt: plan === 'expired' ? (me.trialEndsAt ?? view.until) : null,
    session: { pct: u?.session.pct ?? null, resetAt: u?.session.resetAt ?? null },
    week: { pct: u?.week.pct ?? null, resetAt: u?.week.resetAt ?? null },
    sparksLeft: u?.sparksLeft ?? 0,
    lastPackSparks: null,
    hasBoughtSparks: (me.subscription?.purchases ?? []).some((p) => p.type === 'NON_RENEWING_PURCHASE'),
    plans: { used: u?.plans.used ?? 0, limit: planLimit, readOnly: planLimit !== null && (u?.plans.used ?? 0) > planLimit ? (u?.plans.used ?? 0) - planLimit : 0 },
    balanceViews: { used: u?.balanceViews.used ?? 0, limit: u?.balanceViews.limit ?? null },
    advisor: { entitled: u?.advisor.entitled ?? true, freeLeft: u?.advisor.free_left ?? 0 },
    resetsUnseen: u?.resetsUnseen ?? [],
    billing: { issue: view.kind === 'issue', cancelledEndsAt: view.kind === 'canceled' ? view.until : null },
    signals,
    offline,
    now,
  }
}

export function useNoticeState(): NoticeState | null {
  const me = useBillingStore((s) => s.me)
  const signals = useUsageStore((s) => s.signals)
  const { online } = useNetworkStatus()
  // The clock is state, refreshed once a minute, so the rules never read it during render.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return useMemo(() => buildNoticeState(me, signals, !online, now), [me, signals, online, now])
}
