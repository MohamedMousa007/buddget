import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

const h = vi.hoisted(() => ({ fetch: vi.fn(), sdk: vi.fn(), trial: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))
vi.mock('@/lib/billing/purchases', () => ({
  startPurchases: h.sdk, stopPurchases: h.sdk, loadPackages: h.sdk, purchasePackage: h.sdk, restorePurchases: h.sdk,
  openManageSubscription: h.sdk, purchasesAvailable: () => true,
}))
vi.mock('@/lib/billing/trialClaim', () => ({ claimTrial: h.trial }))
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

import { BillingHost } from './BillingHost'
import { startBillingSession } from '@/lib/billing/billingSession'
import { MembershipCard } from '@/components/features/settings/hub/MembershipCard'
import { useBillingStore } from '@/lib/billing/billingStore'

beforeEach(() => {
  h.fetch.mockReset(); h.sdk.mockReset(); h.trial.mockReset()
  useBillingStore.getState().reset()
})

describe('while billingEnabled is false', () => {
  it('Settings subscription section renders nothing, even with a store key', () => {
    useBillingStore.setState({ me: { planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: false, sparks: { left: 1, total: 2, resetsAt: null } } })
    expect(renderToStaticMarkup(createElement(MembershipCard))).toBe('')
  })
  it('the host renders nothing', () => {
    expect(renderToStaticMarkup(createElement(BillingHost))).toBe('')
  })
  it('the session starts neither the store SDK nor the trial claim', async () => {
    await startBillingSession('u1', false)
    expect(h.sdk).not.toHaveBeenCalled()
    expect(h.trial).not.toHaveBeenCalled()
  })
})

describe('copy rules', () => {
  it.each([['en', en], ['ar', ar]] as const)('%s: no free-trial wording, no other way to pay', (_l, d) => {
    const text = JSON.stringify(d.billing).toLowerCase()
    for (const bad of ['free trial', 'web', 'website', 'cheaper', 'checkout', 'refund', 'تجربة مجانية', 'الموقع'])
      expect(text).not.toContain(bad)
  })
})

describe('while billingEnabled is true', () => {
  it('starts the SDK as the user and claims the trial once', async () => {
    h.sdk.mockResolvedValue(true)
    h.trial.mockResolvedValue('already_claimed')
    await startBillingSession('u9', true)
    await startBillingSession('u9', true)
    expect(h.sdk).toHaveBeenCalledWith('u9')
    expect(h.trial).toHaveBeenCalledTimes(1)
  })
})
