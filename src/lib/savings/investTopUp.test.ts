import { describe, expect, it } from 'vitest'
import { investTopUpPatch } from '@/lib/savings/investTopUp'

const rates = { USD_EGP: 50, EGP_USD: 0.02 }

describe('investTopUpPatch', () => {
  it('blends the cost basis (weighted average) when topping up a holding with a known cost', () => {
    const p = investTopUpPatch({ quantity: 10, unitCost: 100, costBasisCurrency: 'EGP', currency: 'EGP' }, 5, 750, 'EGP', rates)
    expect(p.quantity).toBe(15)
    expect(p.unitCost).toBeCloseTo((10 * 100 + 750) / 15, 6)
    expect(p.costBasisCurrency).toBe('EGP')
  })

  it('converts the amount into the cost currency', () => {
    const p = investTopUpPatch({ quantity: 2, unitCost: 10, costBasisCurrency: 'USD', currency: 'EGP' }, 2, 1000, 'EGP', rates)
    expect(p.unitCost).toBeCloseTo((2 * 10 + 20) / 4, 6)
  })

  it('does not invent a cost for units whose cost is unknown', () => {
    const p = investTopUpPatch({ quantity: 10, currency: 'EGP' }, 5, 750, 'EGP', rates)
    expect(p.quantity).toBe(15)
    expect(p.unitCost).toBeUndefined()
  })

  it('sets the cost from the top-up when the holding was empty', () => {
    const p = investTopUpPatch({ quantity: 0, currency: 'EGP' }, 5, 500, 'EGP', rates)
    expect(p.unitCost).toBe(100)
    expect(p.costBasisCurrency).toBe('EGP')
  })
})
