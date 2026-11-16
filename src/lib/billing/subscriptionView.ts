import type { BillingMe } from '@/lib/billing/billingStore'

export type SubscriptionKind = 'free' | 'trial' | 'active' | 'canceled' | 'issue' | 'expired'

export interface SubscriptionView {
  kind: SubscriptionKind
  /** Pro features are on right now (a trial, a paid period, a cancelled period still running, a billing-issue grace window). */
  proActive: boolean
  period: 'monthly' | 'yearly' | null
  /** Trial: the 1-based day out of 30, clamped. */
  trialDay: number | null
  trialTotal: 30
  /** The date the next thing happens: the trial's end, the renewal, the end of access, or the grace expiry. */
  until: string | null
  memberSince: string | null
}

const DAY = 86_400_000
// Any store naming (`plus_annual`, `pro_yearly`, Google's `pro:monthly-base`): the period word is in the id.
const periodOf = (productId: string | null | undefined): 'monthly' | 'yearly' | null =>
  !productId ? null : /annual|year/i.test(productId) ? 'yearly' : /month/i.test(productId) ? 'monthly' : null

/** Reads the plan the server reported into the one state a membership screen draws. Pure: the clock is passed in. */
export function subscriptionView(me: BillingMe | null, now = Date.now()): SubscriptionView {
  const sub = me?.subscription ?? null
  const base = { period: periodOf(sub?.productId), trialDay: null, trialTotal: 30 as const, memberSince: sub?.memberSince ?? null }
  if (!me) return { ...base, kind: 'free', proActive: false, until: null }
  const paid = me.planKey !== 'free'
  if (!paid) {
    const wasMember = me.status === 'expired' && !!sub?.memberSince
    return { ...base, kind: wasMember ? 'expired' : 'free', proActive: false, until: sub?.renewsAt ?? null }
  }
  if (me.status === 'trialing') {
    const end = me.trialEndsAt ? Date.parse(me.trialEndsAt) : NaN
    const day = Number.isFinite(end) ? Math.min(30, Math.max(1, 30 - Math.ceil((end - now) / DAY) + 1)) : 1
    return { ...base, kind: 'trial', proActive: true, trialDay: day, until: me.trialEndsAt }
  }
  if (me.status === 'past_due' || sub?.billingIssue) return { ...base, kind: 'issue', proActive: true, until: sub?.graceEndsAt ?? sub?.renewsAt ?? null }
  if (me.status === 'canceled' || sub?.willRenew === false) return { ...base, kind: 'canceled', proActive: true, until: sub?.renewsAt ?? null }
  return { ...base, kind: 'active', proActive: true, until: sub?.renewsAt ?? null }
}
