'use client'

import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { localTodayISO } from '@/lib/utils/localDate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useBillingStore, type BillingMe } from '@/lib/billing/billingStore'
import { useWeekCheckStore } from '@/lib/loyalty/weekCheckStore'
import { useUsageStore } from '@/lib/usage/usageStore'

const DAY = 86_400_000
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString()

/** The signed-in stand-in for QA ("Layla Hassan"). Staff when `localStorage.qa_staff` is set (reload after). Dev-bypass only. */
export function devQaUser(): User {
  const staff = typeof window !== 'undefined' && window.localStorage.getItem('qa_staff') === '1'
  return { id: 'dev-qa', email: 'layla@example.com', app_metadata: staff ? { is_staff: true } : {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } as User
}

export type QaPlan = 'free' | 'active' | 'trial' | 'trialEnding' | 'issue' | 'ended'

/** One call to put the billing store in a plan state: `__qa.plan('trialEnding', { founder: 7 })`. */
function qaPlan(plan: QaPlan, opts: { founder?: number } = {}) {
  const paid = plan !== 'free' && plan !== 'ended'
  const me = {
    planKey: paid ? 'plus' : 'free', planName: paid ? 'Pro' : 'Free', billingEnabled: true, sparks: null,
    status: plan === 'trial' || plan === 'trialEnding' ? 'trialing' : plan === 'issue' ? 'past_due' : plan === 'ended' ? 'expired' : 'active',
    trialEndsAt: plan === 'trial' ? iso(12) : plan === 'trialEnding' ? iso(2) : null,
    subscription: plan === 'free' ? null : { fromStore: true, billingIssue: plan === 'issue', graceEndsAt: null, willRenew: plan !== 'ended', renewsAt: plan === 'ended' ? iso(-16) : iso(13), productId: 'pro_monthly', memberSince: '2026-01-01' },
    rewards: {
      tiersEnabled: true, tier: { key: 'emerald', name: 'Emerald', locked: false }, proActive: paid, points: { lifetime: 540, spendable: 200 }, nextTier: null, tiers: [],
      streak: { current: 0, best: 0, multiplier: 1, nextMultiplierAt: 4, weeks: [], repair: null }, freezes: { banked: 0, max: 2, earnEvery: 8, keptWeeksToNext: 8 },
      founder: opts.founder ? { number: opts.founder, cohort: 'beta', creditName: null, creditNameStatus: 'none' } : null, betaTester: false, memberNumber: 42, packBonusPercent: 0,
      cosmetics: { cardFinish: 'standard', buddgyLook: 'classic', owned: [] }, shop: [], earn: [], invite: { enabled: true, code: 'LAYLA-7K2', link: 'https://buddget.app/i/LAYLA-7K2', invited: 0, activated: 0, rewarded: 0 },
    },
  } as unknown as BillingMe
  useBillingStore.setState({ me })
}

/**
 * DEV-ONLY: mounted solely under the `NEXT_PUBLIC_DEV_AUTH_BYPASS` flag (see
 * AuthProvider). Real auth normally flips `dataReady` via SupabaseFinanceSync,
 * which never mounts without a session — so bypass mode would sit on skeletons.
 * This flips it and seeds a little demo income for local UI QA. Dead code in any
 * production build.
 */
export function DevAuthBypassSeed() {
  useEffect(() => {
    // Expose stores for local QA driving (dev-only).
    ;(window as unknown as Record<string, unknown>).__finance = useFinanceStore
    ;(window as unknown as Record<string, unknown>).__settings = useSettingsStore
    ;(window as unknown as Record<string, unknown>).__billing = useBillingStore
    ;(window as unknown as Record<string, unknown>).__weekCheck = useWeekCheckStore
    ;(window as unknown as Record<string, unknown>).__usage = useUsageStore
    ;(window as unknown as Record<string, unknown>).__qa = { plan: qaPlan, lang: (language: 'en' | 'ar') => useFinanceStore.getState().updateSettings({ language }), theme: (theme: 'light' | 'dark') => useFinanceStore.getState().updateSettings({ theme }), name: (name: string) => useFinanceStore.getState().updateProfile({ name }) }
    const st = useFinanceStore.getState()
    st.setDataReady(true)
    if (!st.profile.name) st.updateProfile({ name: 'Layla Hassan' })
    if (st.incomeSources.length === 0) {
      st.addIncomeSource({ name: 'Salary · Nexta', amount: 42000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 5, sourceType: 'salary' })
      st.addIncomeSource({ name: 'Upwork', amount: 6000, currency: 'EGP', isRecurring: true, recurringFrequency: 'biweekly', dayOfMonth: 3, sourceType: 'side_hustle' })
      st.addIncomeEvent({ name: 'Refund · Amazon', amount: 8240, currency: 'EGP', sourceType: 'refund', receivedDate: localTodayISO(), status: 'confirmed' })
    }
  }, [])
  return null
}
