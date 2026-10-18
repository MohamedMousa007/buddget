import { describe, expect, it } from 'vitest'
import { findBrandByKey } from '@/lib/constants/subscriptionCatalog'
import { addCategoryOf, catalogGrid, defaultPlan, tilePrice } from './catalogDisplay'

const brand = (k: string) => findBrandByKey(k)!

describe('catalogGrid', () => {
  it('orders Egypt by Egyptian usage and only lists brands sold there', () => {
    const keys = catalogGrid('egypt', null, '').map((b) => b.key)
    expect(keys.slice(0, 5)).toEqual(['netflix', 'shahid_vip', 'spotify', 'anghami', 'youtube_premium'])
    expect(keys).not.toContain('jawwy_tv')
  })
  it('filters by category chip and by search', () => {
    expect(catalogGrid('egypt', 'music', '').every((b) => addCategoryOf(b) === 'music')).toBe(true)
    expect(catalogGrid('egypt', null, 'netf').map((b) => b.key)).toEqual(['netflix'])
  })
  it('puts delivery memberships under shopping and VPNs under software', () => {
    expect(addCategoryOf(brand('talabat_pro'))).toBe('shopping')
    expect(addCategoryOf(brand('nordvpn'))).toBe('ai')
  })
})

describe('defaultPlan / tilePrice', () => {
  it('quotes Netflix Standard and a typical (not ≈) price when verified in EGP', () => {
    const plan = defaultPlan(brand('netflix'), 'egypt')!
    expect(plan.id).toBe('netflix_standard')
    expect(tilePrice(plan, 'egypt')).toEqual({ currency: 'EGP', amount: 190, approx: false })
  })
  it('marks a USD-billed plan approximate', () => {
    const plan = { id: 'x', name: 'Plus', amount: 20, currency: 'USD' as const, cycle: 'monthly' as const, verifiedAt: '2026-10-17' }
    expect(tilePrice(plan, 'egypt')).toEqual({ currency: 'USD', amount: 20, approx: true })
  })
  it('marks an unverified price approximate', () => {
    expect(tilePrice({ id: 'x', name: 'X', amount: 99, cycle: 'monthly' }, 'egypt').approx).toBe(true)
  })
})
