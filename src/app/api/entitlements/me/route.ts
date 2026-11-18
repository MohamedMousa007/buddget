import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { billingEnabled } from '@/lib/entitlements/billingSwitch'
import { cachedSetting } from '@/lib/server/platformCache'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import type { HistoryItem, ProThisMonth, RewardsState, SparkProduct, SubscriptionRow } from '@/lib/loyalty/rewardsTypes'

/**
 * Everything the Pro, Usage, Rewards, Founders and Invite pages read, in one database call (`entitlements_state`, which also runs
 * the per-user upkeep: the friend's own activation check, banked Pro weeks, the tier) plus the plan resolution. The switch and the
 * packs are cached server-side. Shapes: docs/launch/PRO_REWARDS_CONTRACT.md.
 */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const service = createServiceRoleClient()
  // The state call first: its upkeep may start banked Pro weeks, which the plan resolution must then see.
  const [state, enabled, sparkProducts] = await Promise.all([loadState(service, uid), billingEnabled(service), sparkProductsCached(service)])
  const entitlements = await getUserEntitlements(service, uid)
  const usage = enabled ? (state?.usage ?? null) : null
  const sparks = usage && usage.sparksLeft > 0 ? { left: usage.sparksLeft, total: usage.sparksLeft, resetsAt: null } : null
  const rewards = state?.rewards ?? null
  // An invite adds 7 days to the 30-day trial (referral_redeem). Only asked while trialing: one indexed row (referrals_invitee_id_key).
  const trialDays = entitlements.status === 'trialing' ? await trialLength(service, uid) : null
  return NextResponse.json({
    ...entitlements,
    trialDays,
    // `billingEnabled` is the one server-side switch for selling.
    billingEnabled: enabled,
    sparks,
    usage,
    sparkProducts: enabled ? sparkProducts : [],
    rewards,
    proThisMonth: state?.proThisMonth ?? null,
    history: state?.history ?? [],
    loyalty: rewards ? legacyLoyalty(rewards) : null,
    subscription: state ? subscriptionView(state.subscription, state.history) : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export interface UsageWindow { used: number; limit: number | null; resetAt: string | null; pct: number | null }
export interface UsageState {
  session: UsageWindow
  week: UsageWindow
  byFeature: Record<string, number>
  sparksLeft: number
  balanceViews: { used: number; limit: number | null; resetAt: string }
  plans: { used: number; limit: number | null }
  advisor: { entitled: boolean; free_left: number; free_total: number }
  resetsUnseen: Array<'session' | 'week'>
  interest: string[]
}

const TRIAL_DAYS = 30
const INVITE_TRIAL_BONUS_DAYS = 7

async function trialLength(service: ReturnType<typeof createServiceRoleClient>, uid: string): Promise<number> {
  const { data } = await service.from('referrals').select('id').eq('invitee_id', uid).eq('trial_bonus_applied', true).limit(1).maybeSingle()
  return data ? TRIAL_DAYS + INVITE_TRIAL_BONUS_DAYS : TRIAL_DAYS
}

interface EntitlementsState {
  usage: UsageState | null
  subscription: SubscriptionRow
  history: HistoryItem[]
  proThisMonth: ProThisMonth
  rewards: RewardsState
}

async function loadState(service: ServiceClient, uid: string): Promise<EntitlementsState | null> {
  const { data, error } = await service.rpc('entitlements_state', { p_user: uid })
  if (error || !data) {
    if (error) console.error('[entitlements/me] state failed', error.message)
    return null
  }
  return data as unknown as EntitlementsState
}

const PACKS_TTL_MS = 300_000
let packs: { at: number; list: SparkProduct[] } | null = null

/** The active Sparks packs (owner-set rows): cached per instance and in the shared data cache for 5 minutes. */
async function sparkProductsCached(service: ServiceClient): Promise<SparkProduct[]> {
  if (packs && Date.now() - packs.at < PACKS_TTL_MS) return packs.list
  try {
    const list = await cachedSetting(['spark_products'], async () => {
      const { data, error } = await service.from('spark_products').select('product_id, sparks, countries').eq('active', true).order('sparks')
      if (error) throw new Error(error.message)
      return (data ?? []).map((p) => ({ id: p.product_id, sparks: p.sparks, countries: p.countries ?? null }))
    }, 300)
    packs = { at: Date.now(), list }
    return list
  } catch {
    return packs?.list ?? []
  }
}

/** The older `loyalty` block, kept for the screens that read it. */
function legacyLoyalty(r: RewardsState) {
  return {
    founderNumber: r.founder?.number ?? null,
    betaTester: r.betaTester,
    streakWeeks: r.streak.current,
    freezesBanked: r.freezes.banked,
    lifetimePoints: r.points.lifetime,
    tier: r.tier?.key ?? null,
  }
}

/**
 * The Pro page's subscription facts: the store's billing-issue flag with its grace expiry (a past_due plan keeps access to
 * `graceEndsAt`, or three days after the period end when the store reported none), renewal, member-since and the receipts.
 */
function subscriptionView(e: SubscriptionRow, history: HistoryItem[]) {
  const store = e.source === 'apple' || e.source === 'google'
  const graceEndsAt = e.status === 'past_due'
    ? (e.graceEndsAt ?? (e.currentPeriodEnd ? new Date(new Date(e.currentPeriodEnd).getTime() + 3 * 86_400_000).toISOString() : null))
    : null
  const purchases = history.map((h) => ({ at: h.at, type: h.type, store: h.store, productId: h.productId, priceMicros: h.priceMicros, currency: h.currency, kind: h.kind, sparks: h.sparks, bonusSparks: h.bonusSparks, refundedAt: h.refundedAt }))
  return {
    fromStore: store,
    billingIssue: e.status === 'past_due',
    graceEndsAt,
    willRenew: store ? e.willRenew : null,
    renewsAt: store ? e.currentPeriodEnd : null,
    productId: store ? e.productId : null,
    memberSince: e.memberSince,
    canceledAt: e.canceledAt,
    bankedProDays: e.bankedProDays,
    purchases,
    hasMorePurchases: purchases.length > 5,
  }
}
