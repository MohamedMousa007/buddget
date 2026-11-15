import { create } from 'zustand'
import { apiFetchAuth } from '@/lib/apiBase'
import { quotaDeniedOffersUpgrade } from '@/lib/ai/quotaDeniedCopy'
import type { EntitlementStatus } from '@/lib/entitlements/resolve'

export interface BillingMe {
  planKey: string
  planName: string
  status: EntitlementStatus
  trialEndsAt: string | null
  billingEnabled: boolean
  sparks: { left: number; total: number; resetsAt: string | null } | null
  loyalty?: { founderNumber: number | null; betaTester: boolean; streakWeeks: number; freezesBanked: number; lifetimePoints: number; tier: string | null } | null
  subscription?: { fromStore: boolean; billingIssue: boolean; graceEndsAt: string | null; willRenew: boolean | null; renewsAt: string | null; productId: string | null; memberSince: string | null } | null
}

interface BillingStore {
  me: BillingMe | null
  paywallOpen: boolean
  refresh: () => Promise<BillingMe | null>
  openPaywall: () => void
  closePaywall: () => void
  reset: () => void
}

/** The one switch every billing surface reads: false until the server says true, so nothing shows by default. */
export const billingOn = (me: BillingMe | null | undefined): boolean => me?.billingEnabled === true

export const isPaidPlan = (me: BillingMe | null | undefined): boolean => !!me && me.planKey !== 'free'

export const useBillingStore = create<BillingStore>((set, get) => ({
  me: null,
  paywallOpen: false,
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
  openPaywall: () => {
    if (!billingOn(get().me)) return
    set({ paywallOpen: true })
    // Measurement only (S5c item 27); the server reads the country and ignores the call while billing is off.
    void apiFetchAuth('/api/billing/paywall-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'paywall' }) }).catch(() => {})
  },
  closePaywall: () => set({ paywallOpen: false }),
  reset: () => set({ me: null, paywallOpen: false }),
}))

/** Called wherever an AI request is refused. Only a spent Sparks balance opens the paywall, and only while billing is on. */
export function noteQuotaDenial(layer: string | undefined): void {
  if (quotaDeniedOffersUpgrade(layer)) useBillingStore.getState().openPaywall()
}

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
