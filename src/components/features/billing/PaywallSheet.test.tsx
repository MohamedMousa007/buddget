import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { en } from '@/lib/i18n/dictionaries/en'

const state = {
  paywallOpen: true,
  closePaywall: () => {},
  me: { planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: { left: 0, total: 20, resetsAt: null } },
}
vi.mock('@/lib/billing/billingStore', () => ({
  useBillingStore: (pick: (s: typeof state) => unknown) => pick(state),
  billingOn: (me: { billingEnabled?: boolean } | null) => me?.billingEnabled === true,
  refreshUntilPaid: async () => true,
}))
vi.mock('@/lib/billing/purchases', () => ({ loadPackages: async () => [], purchasePackage: vi.fn(), restorePurchases: vi.fn() }))
vi.mock('@/components/modals/ModalShell', () => ({ ModalShell: ({ children }: { children: unknown }) => children, useModalTitleId: () => 'paywall-title' }))

import { PaywallSheet } from './PaywallSheet'

describe('PaywallSheet', () => {
  it('offers Restore beside the purchase, as App Review expects', () => {
    expect(renderToStaticMarkup(createElement(PaywallSheet))).toContain(en.billing.restore)
  })
})
