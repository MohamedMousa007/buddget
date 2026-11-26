import { describe, expect, it } from 'vitest'
import { switchBorrowGold, type GoldSwitchCtx } from '@/lib/debts/borrowGold'

const ctx: GoldSwitchCtx = { pricePerGram24k: 4000, priceAvailable: true, karat: 21, base: 'EGP', rates: { USD_EGP: 50 } }

describe('gold-backed switch on a borrow', () => {
  it('turns 1,200 EGP into grams of the chosen karat at today’s price, not 1,200 g', () => {
    const r = switchBorrowGold({ amount: '1200', currency: 'EGP', toGold: true, memo: null }, ctx)
    expect(r.currency).toBe('XAU')
    expect(r.amount).toBe('0.343') // 1200 / (4000 × 21/24)
    expect(r.cleared).toBe(false)
  })

  it('switching back untouched gives the typed figure, with no rounding drift', () => {
    const on = switchBorrowGold({ amount: '1200', currency: 'EGP', toGold: true, memo: null }, ctx)
    const off = switchBorrowGold({ amount: on.amount, currency: 'XAU', toGold: false, memo: on.memo }, ctx)
    expect(off).toMatchObject({ amount: '1200', currency: 'EGP', memo: null })
  })

  it('edited grams convert back to base money', () => {
    const on = switchBorrowGold({ amount: '1200', currency: 'EGP', toGold: true, memo: null }, ctx)
    const off = switchBorrowGold({ amount: '2', currency: 'XAU', toGold: false, memo: on.memo }, ctx)
    expect(off).toMatchObject({ amount: '7000', currency: 'EGP' })
  })

  it('converts a foreign amount through the base currency', () => {
    const r = switchBorrowGold({ amount: '70', currency: 'USD', toGold: true, memo: null }, ctx)
    expect(r.amount).toBe('1') // 70 USD = 3,500 EGP = 1 g of 21k
  })

  it('clears with a hint when there is no live gold price', () => {
    const r = switchBorrowGold({ amount: '1200', currency: 'EGP', toGold: true, memo: null }, { ...ctx, priceAvailable: false })
    expect(r).toMatchObject({ amount: '', currency: 'XAU', cleared: true })
  })

  it('an empty amount only changes the unit', () => {
    expect(switchBorrowGold({ amount: '', currency: 'EGP', toGold: true, memo: null }, ctx)).toMatchObject({ amount: '', currency: 'XAU', cleared: false })
  })
})
