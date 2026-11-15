import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))

import { billingOn, isPaidPlan, noteQuotaDenial, refreshUntilPaid, useBillingStore, type BillingMe } from './billingStore'
import { buildPlanOptions } from './planOptions'

const me = (over: Partial<BillingMe> = {}): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: false, sparks: null, ...over })
const reply = (body: BillingMe) => ({ ok: true, json: async () => body })

beforeEach(() => {
  h.fetch.mockReset()
  useBillingStore.getState().reset()
})

describe('the billing-off gate', () => {
  it('shows nothing and cannot open the paywall before the server answers', () => {
    expect(billingOn(null)).toBe(false)
    useBillingStore.getState().openPaywall()
    noteQuotaDenial('sparks')
    expect(useBillingStore.getState().paywallOpen).toBe(false)
  })

  it('stays closed on a sparks denial while billingEnabled is false', async () => {
    h.fetch.mockResolvedValue(reply(me()))
    await useBillingStore.getState().refresh()
    noteQuotaDenial('sparks')
    expect(useBillingStore.getState().paywallOpen).toBe(false)
  })

  it('opens on a sparks denial once billing is on, never on a time-window denial', async () => {
    h.fetch.mockResolvedValue(reply(me({ billingEnabled: true })))
    await useBillingStore.getState().refresh()
    noteQuotaDenial('window_5h')
    expect(useBillingStore.getState().paywallOpen).toBe(false)
    noteQuotaDenial('sparks')
    expect(useBillingStore.getState().paywallOpen).toBe(true)
  })

  it('a failed read leaves billing off', async () => {
    h.fetch.mockRejectedValue(new Error('offline'))
    await useBillingStore.getState().refresh()
    expect(billingOn(useBillingStore.getState().me)).toBe(false)
  })
})

describe('refreshUntilPaid', () => {
  it('retries until the webhook has granted the plan', async () => {
    h.fetch.mockResolvedValueOnce(reply(me({ billingEnabled: true }))).mockResolvedValueOnce(reply(me({ billingEnabled: true, planKey: 'plus' })))
    expect(await refreshUntilPaid(3, 0)).toBe(true)
    expect(h.fetch).toHaveBeenCalledTimes(2)
  })
  it('gives up after the attempts', async () => {
    h.fetch.mockResolvedValue(reply(me({ billingEnabled: true })))
    expect(await refreshUntilPaid(2, 0)).toBe(false)
    expect(isPaidPlan(useBillingStore.getState().me)).toBe(false)
  })
})

describe('plan options copy rules', () => {
  const pkg = (packageType: string, priceString: string, pricePerMonthString: string | null) => ({ packageType, product: { priceString, pricePerMonthString } }) as never
  it('annual comes first and its main price is the yearly amount', () => {
    const o = buildPlanOptions([pkg('MONTHLY', '$4.99', null), pkg('ANNUAL', '$39.99', '$3.33'), pkg('LIFETIME', '$99', null)])
    expect(o.map((x) => x.kind)).toEqual(['annual', 'monthly'])
    expect(o[0].price).toBe('$39.99')
    expect(o[0].perMonth).toBe('$3.33')
    expect(o[1].perMonth).toBeNull()
  })
})
