import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  me: null as unknown,
  user: { id: 'u1', email: 'layla@example.com', app_metadata: {} as Record<string, unknown> } as { id: string; email: string; app_metadata: Record<string, unknown> } | null,
  pct: 100,
  name: 'Layla Hassan',
}))

vi.mock('@/lib/billing/billingStore', async (actual) => ({
  ...(await actual<typeof import('@/lib/billing/billingStore')>()),
  useBillingStore: Object.assign((select: (s: { me: unknown }) => unknown) => select({ me: h.me }), { setState: (s: { me: unknown }) => { h.me = s.me }, getState: () => ({}) }),
}))
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: h.user, openAuthModal: vi.fn() }) }))
vi.mock('@/hooks/useSetupProgress', () => ({ useSetupProgress: () => ({ pct: h.pct }) }))
vi.mock('@/lib/alerts/usePending', () => ({ usePendingEntries: () => [] }))
vi.mock('@/lib/navigation/navStore', () => ({ useNavPath: () => '/flow' }))
vi.mock('@/lib/navigation/backGuard', () => ({ registerBackGuard: () => () => {} }))
vi.mock('@/lib/store/useFinanceStore', () => ({ useFinanceStore: (select: (s: unknown) => unknown) => select({ profile: { name: h.name, email: '' } }) }))
vi.mock('@/lib/store/useSettingsStore', () => ({ useSettingsStore: (select: (s: unknown) => unknown) => select({ setActiveModal: vi.fn() }) }))
vi.mock('@/components/features/setup/SetupProgressChip', () => ({ SetupChecklistSheet: () => null }))
vi.mock('@/lib/profile/avatarDisplay', () => ({ resolveProfileAvatarSrc: () => null }))

import { ProfileDropdown } from './ProfileDropdown'
import type { BillingMe } from '@/lib/billing/billingStore'
import type { RewardsState } from '@/lib/loyalty/rewardsTypes'

const rewards = (over: Partial<RewardsState> = {}): RewardsState => ({
  tiersEnabled: true, tier: { key: 'emerald', name: 'Emerald', locked: false }, proActive: false, points: { lifetime: 540, spendable: 200 }, nextTier: null, tiers: [],
  streak: { current: 0, best: 0, multiplier: 1, nextMultiplierAt: 4, weeks: [], repair: null }, freezes: { banked: 0, max: 2, earnEvery: 8, keptWeeksToNext: 8 },
  founder: null, betaTester: false, memberNumber: 42, packBonusPercent: 0, cosmetics: { cardFinish: 'standard', buddgyLook: 'classic', owned: [] }, shop: [], earn: [],
  invite: { enabled: true, code: 'X', link: 'https://buddget.app/i/X', invited: 0, activated: 0, rewarded: 0 }, ...over,
})
const me = (over: Partial<BillingMe>): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, rewards: rewards(), ...over })

const render = () => renderToStaticMarkup(createElement(ProfileDropdown, { open: true, onClose: () => {}, containerRef: { current: null } }))

beforeEach(() => {
  h.me = me({})
  h.user = { id: 'u1', email: 'layla@example.com', app_metadata: {} }
  h.pct = 100
  h.name = 'Layla Hassan'
})

describe('the profile menu', () => {
  it('a Free member: name, tier chip, a Try free Pro row, the six tools, and nothing else', () => {
    const out = render()
    expect(out).toContain('Layla Hassan')
    expect(out).toContain('Emerald')
    expect(out).toContain('buddget Pro')
    expect(out).toContain('Try free')
    expect(out).toContain('data-pro-mark')
    for (const href of ['/goals', '/paydays', '/subscriptions', '/reports', '/settings"']) expect(out).toContain(`href="${href.replace('"', '')}`)
    expect(out).toContain('Cards')
    expect(out).not.toContain('buddget staff')
    expect(out).not.toContain('Sign out')
    expect(out).not.toContain('Help')
    expect(out).not.toContain('role="switch"')
  })

  it('an active Pro member sees the PRO tag on the avatar and no Pro row', () => {
    h.me = me({ planKey: 'plus', status: 'active', rewards: rewards({ proActive: true }), subscription: { productId: 'pro_monthly', memberSince: '2026-01-01', renewsAt: '2026-12-02T00:00:00Z', willRenew: true } } as Partial<BillingMe>)
    const out = render()
    expect(out).toContain('>PRO<')
    expect(out).not.toContain('Try free')
    expect(out).not.toContain('data-pro-mark')
    expect(out).not.toContain('href="/settings/pro"')
  })

  it('a founder: the numbered chip opens the Founders club; a long name falls back to the first name', () => {
    h.me = me({ rewards: rewards({ founder: { number: 7, cohort: 'beta', creditName: null, creditNameStatus: 'none' } }) })
    h.name = 'Mohamed Ahmed Abdel Rahman El Sayed'
    const out = render()
    expect(out).toContain('#007')
    expect(out).toContain('href="/settings/founders"')
    expect(out).toContain('>Mohamed<')
    expect(out).not.toContain('El Sayed<')
  })

  it('an admin gets the staff strip with Open portal, and no Admin badge beside the name', () => {
    h.user = { id: 'u1', email: 'a@example.com', app_metadata: { is_staff: true } }
    const out = render()
    expect(out).toContain('buddget staff')
    expect(out).toContain('Open portal')
    expect(out).not.toContain('Admin portal')
  })

  it('a staff strip is for staff only', () => {
    expect(render()).not.toContain('Open portal')
  })

  it('setup bar shows only while setup is unfinished', () => {
    expect(render()).not.toContain('role="progressbar"')
    h.pct = 60
    expect(render()).toContain('60%')
  })

  it('a payment issue shows Fix; an ended plan shows no Pro row', () => {
    h.me = me({ planKey: 'plus', status: 'past_due', rewards: rewards({ proActive: true }) })
    expect(render()).toContain('Fix')
    h.me = me({ planKey: 'free', status: 'expired', subscription: { productId: 'pro_monthly', memberSince: '2026-01-01', renewsAt: '2026-11-03T00:00:00Z', willRenew: false } } as Partial<BillingMe>)
    expect(render()).not.toContain('Restart')
  })
})
