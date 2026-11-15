import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { billingEnabled } from '@/lib/entitlements/billingSwitch'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** What the signed-in user's plan allows. The app reads this once gating (freemium, trials) ships. */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const service = createServiceRoleClient()
  const [entitlements, enabled] = await Promise.all([getUserEntitlements(service, uid), billingEnabled(service)])
  const sparks = enabled ? await sparksBalance(service, uid) : null
  const loyalty = enabled ? await loyaltyStatus(service, uid) : null
  const subscription = enabled ? await subscriptionState(service, uid) : null
  // `billingEnabled` is the one server-side switch: while it is false the app shows no paywall, no purchase entry point and no Sparks.
  return NextResponse.json({ ...entitlements, billingEnabled: enabled, sparks, loyalty, subscription }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** What the balance line shows: Sparks left now, the allowance they came from, and when the open allowance ends. */
async function sparksBalance(service: ReturnType<typeof createServiceRoleClient>, uid: string) {
  const now = new Date().toISOString()
  const { data } = await service.from('spark_allowances').select('granted, used, period_end').eq('user_id', uid).lte('period_start', now).gt('period_end', now)
  if (!data?.length) return null
  return {
    left: data.reduce((n, r) => n + (r.granted - r.used), 0),
    total: data.reduce((n, r) => n + r.granted, 0),
    resetsAt: data.map((r) => r.period_end).sort().at(-1) ?? null,
  }
}

/** Loyalty status, shown only once selling is on (the Beta tester badge is never presented as a reward). Tiers are off, so `tier` stays null. */
async function loyaltyStatus(service: ReturnType<typeof createServiceRoleClient>, uid: string) {
  const [founder, beta, account] = await Promise.all([
    service.from('founders').select('number').eq('user_id', uid).is('retired_at', null).maybeSingle(),
    service.from('beta_testers').select('user_id').eq('user_id', uid).maybeSingle(),
    service.from('loyalty_accounts').select('streak_weeks, freezes_banked, lifetime_points, tier_key').eq('user_id', uid).maybeSingle(),
  ])
  return {
    founderNumber: founder.data?.number ?? null,
    betaTester: !!beta.data,
    streakWeeks: account.data?.streak_weeks ?? 0,
    freezesBanked: account.data?.freezes_banked ?? 0,
    lifetimePoints: account.data?.lifetime_points ?? 0,
    tier: account.data?.tier_key ?? null,
  }
}

/**
 * What the Pro page needs beyond the plan: the store's billing-issue flag with its grace expiry (a past_due plan keeps access to
 * `graceEndsAt`, or three days after the period end when the store reported none), whether it renews, and the member-since date.
 */
async function subscriptionState(service: ReturnType<typeof createServiceRoleClient>, uid: string) {
  const [ent, first] = await Promise.all([
    service.from('user_entitlements').select('status, source, will_renew, current_period_end, grace_ends_at, product_id').eq('user_id', uid).maybeSingle(),
    service.from('billing_events').select('event_at').eq('user_id', uid).eq('type', 'INITIAL_PURCHASE').order('event_at').limit(1).maybeSingle(),
  ])
  const e = ent.data
  const store = e?.source === 'apple' || e?.source === 'google'
  const graceEndsAt = e?.status === 'past_due'
    ? (e.grace_ends_at ?? (e.current_period_end ? new Date(new Date(e.current_period_end).getTime() + 3 * 86_400_000).toISOString() : null))
    : null
  return {
    fromStore: store,
    billingIssue: e?.status === 'past_due',
    graceEndsAt,
    willRenew: store ? (e?.will_renew ?? null) : null,
    renewsAt: store ? (e?.current_period_end ?? null) : null,
    productId: store ? (e?.product_id ?? null) : null,
    memberSince: first.data?.event_at ?? null,
  }
}
