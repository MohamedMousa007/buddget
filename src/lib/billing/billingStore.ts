import { create } from 'zustand'
import { apiFetchAuth } from '@/lib/apiBase'
import type { EntitlementStatus } from '@/lib/entitlements/resolve'
import type { HistoryItem, ProThisMonth, RewardsState } from '@/lib/loyalty/rewardsTypes'
import { subscriptionView } from './subscriptionView'

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
  /** Length of the running trial in days: 30, or 37 after joining through an invite. Null when not trialing. */
  trialDays?: number | null
  billingEnabled: boolean
  /** Plan features the server resolved for this user (plan plus overrides), e.g. `advanced_reports`. */
  features?: string[]
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
  /** True when the last read failed and there is still no plan to show; the pages offer Try again instead of a skeleton. */
  error: boolean
  refresh: () => Promise<BillingMe | null>
  reset: () => void
}

/** The one switch every billing surface reads: false until the server says true, so nothing shows by default. */
export const billingOn = (me: BillingMe | null | undefined): boolean => me?.billingEnabled === true

/** Pro that a store sold and the server recorded. A trial is not, and neither is a lapsed store row (`fromStore` stays true on it). */
export const storeConfirmed = (me: BillingMe | null | undefined): boolean => !!me?.subscription?.fromStore && subscriptionView(me).proActive

export const useBillingStore = create<BillingStore>((set, get) => ({
  me: null,
  error: false,
  refresh: async () => {
    if (get().error) set({ error: false })
    try {
      const res = await apiFetchAuth('/api/entitlements/me')
      if (!res.ok) {
        set({ error: true })
        return get().me
      }
      const me = (await res.json()) as BillingMe
      set({ me, error: false })
      return me
    } catch {
      set({ error: true })
      return get().me
    }
  },
  reset: () => set({ me: null, error: false }),
}))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** After a purchase or restore the webhook grants access; the app only reflects it, so poll briefly until the store's Pro shows. */
export async function refreshUntilStore(attempts = 6, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const me = await useBillingStore.getState().refresh()
    if (storeConfirmed(me)) return true
    if (i < attempts - 1) await sleep(delayMs)
  }
  return false
}

/** Asks the server to read this account from RevenueCat (for a webhook that never came), then reads the plan. User-triggered only. */
export async function confirmWithStore(): Promise<boolean> {
  await apiFetchAuth('/api/billing/sync', { method: 'POST' }).catch(() => undefined)
  return storeConfirmed(await useBillingStore.getState().refresh())
}
