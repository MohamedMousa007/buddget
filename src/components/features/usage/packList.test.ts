import { describe, expect, it } from 'vitest'
import { packBonusSparks, packTotalSparks } from '@/components/features/membership/SparksPacks'
import { packLists } from './packList'

const PRODUCTS = [
  { id: 'sparks_2000', sparks: 2000, countries: null },
  { id: 'sparks_60', sparks: 60, countries: ['EG'] },
  { id: 'sparks_320', sparks: 320, countries: null },
  { id: 'sparks_125', sparks: 125, countries: ['EG'] },
  { id: 'sparks_650', sparks: 650, countries: null },
]
const ids = (l: { id: string }[]) => l.map((p) => p.id)

describe('the Sparks packs a person sees', () => {
  it('Egypt: three main packs, the two small ones behind More packs with the Egypt tag', () => {
    const l = packLists(PRODUCTS, 'EG', null, 'Egypt')
    expect(ids(l.main)).toEqual(['sparks_320', 'sparks_650', 'sparks_2000'])
    expect(l.extra).toEqual([{ id: 'sparks_60', sparks: 60, price: 'EGP 9.99', tag: 'Egypt' }, { id: 'sparks_125', sparks: 125, price: 'EGP 19.99', tag: 'Egypt' }])
    expect(l.popularId).toBe('sparks_650')
    expect(l.main[1]!.price).toBe('EGP 99.99')
  })
  it('outside Egypt the small packs are absent; Saudi’s largest has its own price', () => {
    expect(packLists(PRODUCTS, 'AE', null, 'Egypt').extra).toEqual([])
    expect(packLists(PRODUCTS, 'SA', null, 'Egypt').main.map((p) => p.price)).toEqual(['SAR 3.99', 'SAR 7.99', 'SAR 21.99'])
    expect(packLists(PRODUCTS, 'US', null, 'Egypt').main.map((p) => p.price)).toEqual(['USD 0.99', 'USD 1.99', 'USD 4.99'])
  })
  it('with the store’s answer, exactly what the store sells here, at its prices', () => {
    const l = packLists(PRODUCTS, 'EG', new Map([['sparks_320', '£E 49.99'], ['sparks_650', '£E 99.99']]), 'Egypt')
    expect(ids(l.main)).toEqual(['sparks_320', 'sparks_650'])
    expect(l.extra).toEqual([])
    expect(l.main[0]!.price).toBe('£E 49.99')
  })
  it('a store that has not answered yet falls back to the owner’s prices', () => {
    expect(ids(packLists(PRODUCTS, 'AE', new Map(), 'Egypt').main)).toHaveLength(3)
  })
  it('the bonus is the server’s percent, rounded down', () => {
    expect(packBonusSparks(650, 15)).toBe(97)
    expect(packTotalSparks({ sparks: 650 }, 15)).toBe(747)
    expect(packTotalSparks({ sparks: 125 }, 20)).toBe(150)
    expect(packTotalSparks({ sparks: 650 }, 0)).toBe(650)
  })
})
