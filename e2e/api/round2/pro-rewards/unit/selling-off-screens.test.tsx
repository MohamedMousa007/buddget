// S8g: the Pro, Rewards, Invite and Founders screens and the Settings cards with selling OFF (store mocked to a loaded `me`).
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({ me: null as unknown }))
vi.mock('@/lib/billing/billingStore', async (orig) => {
  const real = await orig<typeof import('@/lib/billing/billingStore')>()
  const state = () => ({ me: h.me, refresh: async () => undefined, loading: false })
  const useBillingStore = Object.assign((sel: (s: unknown) => unknown) => sel(state()), { getState: state, setState: () => undefined, subscribe: () => () => undefined })
  return { ...real, useBillingStore }
})
vi.mock('@/lib/navigation/navigate', () => ({ navigate: () => undefined }))
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
// next/font only works inside the Next build; the membership card's signature fonts are loaded at import (signatureFont.ts).
vi.mock('next/font/google', () => ({
  Pinyon_Script: () => ({ variable: '__variable_pinyon', className: '__className_pinyon' }),
  Aref_Ruqaa: () => ({ variable: '__variable_aref', className: '__className_aref' }),
}))

const rewards = { tier: { key: 'silver', name: 'Silver', locked: false }, invite: { enabled: true, code: 'AB-123', link: 'https://buddget.app/i/AB-123', invited: 0, activated: 0, rewarded: 0 } }
const meOff = { planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: false, rewards }

describe('screens with selling OFF', () => {
  it('OFF5 Rewards and Invite pages render nothing (they send the user back to Settings)', async () => {
    h.me = meOff
    const Rewards = (await import('@/app/(app)/settings/rewards/page')).default
    const Invite = (await import('@/app/(app)/settings/invite/page')).default
    expect(renderToStaticMarkup(createElement(Rewards))).toBe('')
    expect(renderToStaticMarkup(createElement(Invite))).toBe('')
  })
  it('OFF6 the Settings invite card and the membership card are absent', async () => {
    h.me = meOff
    const { InviteCta } = await import('@/components/features/invite/InviteCta')
    const { MembershipCard } = await import('@/components/features/settings/hub/MembershipCard')
    expect(renderToStaticMarkup(createElement(InviteCta))).toBe('')
    expect(renderToStaticMarkup(createElement(MembershipCard))).toBe('')
  })
  it('OFF7 with selling ON the invite card shows (control)', async () => {
    h.me = { ...meOff, billingEnabled: true }
    const { InviteCta } = await import('@/components/features/invite/InviteCta')
    expect(renderToStaticMarkup(createElement(InviteCta))).not.toBe('')
  })
})
