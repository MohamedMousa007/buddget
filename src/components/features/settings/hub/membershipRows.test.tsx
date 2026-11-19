import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// A server render reads a zustand store's initial state, so the store hook is replaced by a plain holder.
const h = vi.hoisted(() => ({ me: null as unknown }))
vi.mock('@/lib/billing/billingStore', async (actual) => ({
  ...(await actual<typeof import('@/lib/billing/billingStore')>()),
  useBillingStore: Object.assign((select: (s: { me: unknown }) => unknown) => select({ me: h.me }), { setState: (s: { me: unknown }) => { h.me = s.me }, getState: () => ({ reset: () => { h.me = null } }) }),
}))

import { ProfileMemberHead } from '@/components/features/settings/ProfileMemberHead'
import { useBillingStore, type BillingMe } from '@/lib/billing/billingStore'
import type { RewardsState } from '@/lib/loyalty/rewardsTypes'
import { MembershipRows } from './MembershipRows'

const rewards = (over: Partial<RewardsState>): RewardsState => ({
  tiersEnabled: true, tier: { key: 'emerald', name: 'Emerald', locked: false }, proActive: false, points: { lifetime: 540, spendable: 200 }, nextTier: null, tiers: [],
  streak: { current: 0, best: 0, multiplier: 1, nextMultiplierAt: 4, weeks: [], repair: null }, freezes: { banked: 0, max: 2, earnEvery: 8, keptWeeksToNext: 8 },
  founder: null, betaTester: false, memberNumber: 42, packBonusPercent: 0, cosmetics: { cardFinish: 'standard', buddgyLook: 'classic', owned: [] }, shop: [], earn: [],
  invite: { enabled: true, code: 'LAYLA-7K2', link: 'https://buddget.app/i/LAYLA-7K2', invited: 0, activated: 0, rewarded: 0 }, ...over,
})
const me = (over: Partial<BillingMe>): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, rewards: rewards({}), ...over })

beforeEach(() => useBillingStore.getState().reset())

describe('the membership rows of the settings hub', () => {
  it('nothing while billing is off', () => {
    useBillingStore.setState({ me: me({ billingEnabled: false }) })
    expect(renderToStaticMarkup(createElement(MembershipRows))).toBe('')
  })
  it('Pro row with its mark, Rewards with the tier badge, Invite friends; Founders shows only for a founder', () => {
    useBillingStore.setState({ me: me({}) })
    const html = renderToStaticMarkup(createElement(MembershipRows))
    expect(html).toContain('href="/settings/rewards"')
    expect(html).toContain('data-tier="emerald"')
    expect(html).toMatch(/data-testid="rewards-chip"[^>]*class="[^"]*size-9[^"]*rounded-xl/)
    expect(html).toContain('Emerald · tier 2 of 5')
    expect(html).toContain('href="/settings/pro"')
    expect(html).toContain('data-pro-mark="md"')
    expect(html).toContain('Give 37 days of Pro')
    expect(html).not.toContain('/settings/pro/usage')
    expect(html).not.toContain('/settings/founders')
    useBillingStore.setState({ me: me({ rewards: rewards({ founder: { number: 23, cohort: 'beta', creditName: null, creditNameStatus: 'none' } }) }) })
    const founderHtml = renderToStaticMarkup(createElement(MembershipRows))
    expect(founderHtml).toContain('href="/settings/founders"')
    expect(founderHtml).toContain('#023')
    expect(founderHtml).toContain('Only you see this')
  })
})

describe('the profile head', () => {
  it('a Pro founder: PRO tag, founder ring, badge and numbered chip after the name', () => {
    useBillingStore.setState({ me: me({ planKey: 'plus', rewards: rewards({ proActive: true, founder: { number: 23, cohort: 'beta', creditName: null, creditNameStatus: 'none' } }) }) })
    const html = renderToStaticMarkup(createElement(ProfileMemberHead, { name: 'Layla Hassan', avatarSrc: null }))
    expect(html).toContain('PRO')
    expect(html).toContain('data-founder="true"')
    expect(html).toContain('#023')
    expect(html).toContain('Founder #023 · Emerald')
    expect(html).toContain('>LH<')
  })
  it('a Free member: the badge and the plan line, no tag and no chip', () => {
    useBillingStore.setState({ me: me({}) })
    const html = renderToStaticMarkup(createElement(ProfileMemberHead, { name: 'Omar', avatarSrc: null }))
    expect(html).toContain('Free · Emerald')
    expect(html).not.toContain('data-founder')
    expect(html).not.toContain('>PRO<')
  })
  it('absent while billing is off', () => {
    useBillingStore.setState({ me: me({ billingEnabled: false }) })
    expect(renderToStaticMarkup(createElement(ProfileMemberHead, { name: 'Omar', avatarSrc: null }))).toBe('')
  })
})
