import { create } from 'zustand'
import { apiFetchAuth } from '@/lib/apiBase'
import type { EntitlementStatus } from '@/lib/entitlements/resolve'
import type { HistoryItem, ProThisMonth, RewardsState } from '@/lib/loyalty/rewardsTypes'

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

export interface BillingMe {
  planKey: string
  planName: string
  status: EntitlementStatus
  trialEndsAt: string | null
  billingEnabled: boolean
  sparks: { left: number; total: number; resetsAt: string | null } | null
  /** What the usage screens read: both credit windows, Sparks, balance views, plans, the Advisor (from `ai_usage_state`). */
  usage?: UsageState | null
  /** The Sparks packs for sale, by store product id (owner-set settings). */
  sparkProducts?: Array<{ id: string; sparks: number; countries?: string[] | null }>
  /** Tier, points, streak, freezes, founder and member numbers, pack bonus, shop, invite (docs/launch/PRO_REWARDS_CONTRACT.md). */
  rewards?: RewardsState | null
  /** Pro this month: AI answers, receipts scanned, credits used, month on month, with the Free caps for comparison. */
  proThisMonth?: ProThisMonth | null
  /** Subscription receipts and Sparks packs, newest first (30 at most). */
  history?: HistoryItem[]
  loyalty?: { founderNumber: number | null; betaTester: boolean; streakWeeks: number; freezesBanked: number; lifetimePoints: number; tier: string | null } | null
  subscription?: { fromStore: boolean; billingIssue: boolean; graceEndsAt: string | null; willRenew: boolean | null; renewsAt: string | null; productId: string | null; memberSince: string | null; canceledAt?: string | null; bankedProDays?: number; purchases?: Array<{ at: string; type: string; store: string | null; productId: string | null; priceMicros: number | null; currency: string | null; kind?: 'subscription' | 'sparks'; sparks?: number | null; bonusSparks?: number | null; refundedAt?: string | null }>; hasMorePurchases?: boolean } | null
}

interface BillingStore {
  me: BillingMe | null
  refresh: () => Promise<BillingMe | null>
  reset: () => void
}

/** The one switch every billing surface reads: false until the server says true, so nothing shows by default. */
export const billingOn = (me: BillingMe | null | undefined): boolean => me?.billingEnabled === true

export const isPaidPlan = (me: BillingMe | null | undefined): boolean => !!me && me.planKey !== 'free'

export const useBillingStore = create<BillingStore>((set, get) => ({
  me: null,
  refresh: async () => {
    try {
      const res = await apiFetchAuth('/api/entitlements/me')
      if (!res.ok) return get().me
      const me = (await res.json()) as BillingMe
      set({ me })
      return me
    } catch {
      return get().me
    }
  },
  reset: () => set({ me: null }),
}))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** After a purchase or restore the webhook grants access; the app only reflects it, so poll briefly until the plan shows. */
export async function refreshUntilPaid(attempts = 6, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const me = await useBillingStore.getState().refresh()
    if (isPaidPlan(me)) return true
    if (i < attempts - 1) await sleep(delayMs)
  }
  return false
}
