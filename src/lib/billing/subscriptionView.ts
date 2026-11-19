import type { BillingMe } from '@/lib/billing/billingStore'

export type SubscriptionKind = 'free' | 'trial' | 'active' | 'canceled' | 'issue' | 'expired'

export interface SubscriptionView {
  kind: SubscriptionKind
  /** Pro features are on right now (a trial, a paid period, a cancelled period still running, a billing-issue grace window). */
  proActive: boolean
  period: 'monthly' | 'yearly' | null
  /** Trial: the 1-based day out of `trialTotal`, clamped. */
  trialDay: number | null
  /** 30, or 37 when the trial came through an invite. */
  trialTotal: number
  /** The date the next thing happens: the trial's end, the renewal, the end of access, or the grace expiry. */
  until: string | null
  memberSince: string | null
}

const DAY = 86_400_000
// Any store naming (`pro_annual`, `pro_yearly`, Google's `pro:monthly-base`): the period word is in the id.
const periodOf = (productId: string | null | undefined): 'monthly' | 'yearly' | null =>
  !productId ? null : /annual|year/i.test(productId) ? 'yearly' : /month/i.test(productId) ? 'monthly' : null

/** Reads the plan the server reported into the one state a membership screen draws. Pure: the clock is passed in. */
export function subscriptionView(me: BillingMe | null, now = Date.now()): SubscriptionView {
  const sub = me?.subscription ?? null
  const base = { period: periodOf(sub?.productId), trialDay: null, trialTotal: me?.trialDays ?? 30, memberSince: sub?.memberSince ?? null }
  if (!me) return { ...base, kind: 'free', proActive: false, until: null }
  const paid = me.planKey !== 'free'
  if (!paid) {
    const wasMember = me.status === 'expired' && !!sub?.memberSince
    return { ...base, kind: wasMember ? 'expired' : 'free', proActive: false, until: sub?.renewsAt ?? sub?.canceledAt ?? null }
  }
  if (me.status === 'trialing') {
    const end = me.trialEndsAt ? Date.parse(me.trialEndsAt) : NaN
    const total = base.trialTotal
    const day = Number.isFinite(end) ? Math.min(total, Math.max(1, total - Math.ceil((end - now) / DAY) + 1)) : 1
    return { ...base, kind: 'trial', proActive: true, trialDay: day, until: me.trialEndsAt }
  }
  if (me.status === 'past_due' || sub?.billingIssue) return { ...base, kind: 'issue', proActive: true, until: sub?.graceEndsAt ?? sub?.renewsAt ?? null }
  if (me.status === 'canceled' || sub?.willRenew === false) return { ...base, kind: 'canceled', proActive: true, until: sub?.renewsAt ?? null }
  return { ...base, kind: 'active', proActive: true, until: sub?.renewsAt ?? null }
}
