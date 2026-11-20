import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))

import { billingOn, isPaidPlan, refreshUntilPaid, useBillingStore, type BillingMe } from './billingStore'
import { buildPlanOptions } from './planOptions'

const me = (over: Partial<BillingMe> = {}): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: false, sparks: null, ...over })
const reply = (body: BillingMe) => ({ ok: true, json: async () => body })

beforeEach(() => {
  h.fetch.mockReset()
  useBillingStore.getState().reset()
})

describe('the billing-off gate', () => {
  it('shows nothing before the server answers', () => {
    expect(billingOn(null)).toBe(false)
    expect(useBillingStore.getState().me).toBeNull()
  })

  it('S8G-07: a failed read raises the error flag, and a good retry clears it', async () => {
    h.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await useBillingStore.getState().refresh()
    expect(useBillingStore.getState().error).toBe(true)
    h.fetch.mockResolvedValueOnce(reply(me()))
    await useBillingStore.getState().refresh()
    expect(useBillingStore.getState()).toMatchObject({ error: false, me: expect.objectContaining({ planKey: 'free' }) })
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
