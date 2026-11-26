import { describe, it, expect } from 'vitest'
import { formatCompact, formatCurrency, formatMoneyHero, formatQuantity, formatWhole } from './formatters'

describe('formatQuantity', () => {
  it('keeps crypto and gold decimals, trims zeros', () => {
    expect(formatQuantity(0.0123, 'crypto')).toBe('0.0123')
    expect(formatQuantity(0.00012345678, 'crypto')).toBe('0.00012346')
    expect(formatQuantity(2.5, 'gold')).toBe('2.5')
    expect(formatQuantity(1250, 'stock')).toBe('1,250')
  })
})

describe('formatCurrency signs and precision', () => {
  it('puts the sign before the symbol', () => {
    expect(formatCurrency(-5, 'USD')).toBe('-$5.00')
    expect(formatCurrency(-5, 'AED')).toBe('-Dh 5.00')
  })
  it('never emits -0', () => {
    expect(formatCurrency(-0.004, 'USD')).toBe('$0.00')
    expect(formatWhole(-0.4)).toBe('0')
    expect(formatMoneyHero(-0.4, 'USD')).toBe('$0')
    expect(formatMoneyHero(-1234, 'USD')).toBe('-$1,234')
  })
  it('shows BTC and gold decimals', () => {
    expect(formatCurrency(0.00012, 'BTC')).toBe('₿0.00012')
    expect(formatCurrency(2.5, 'XAU')).toBe('2.5g')
  })
})

describe('formatCurrency smart cents', () => {
  it('drops .00 when there are no cents and keeps them when there are', () => {
    expect(formatCurrency(1250, 'USD', 'smart')).toBe('$1,250')
    expect(formatCurrency(1250.5, 'USD', 'smart')).toBe('$1,250.50')
    expect(formatCurrency(-19.99, 'AED', 'smart')).toBe('-Dh 19.99')
    expect(formatCurrency(1250.004, 'USD', 'smart')).toBe('$1,250')
  })
  it('follows three-decimal currencies and leaves gold and crypto alone', () => {
    expect(formatCurrency(5, 'OMR', 'smart')).toBe('RO 5')
    expect(formatCurrency(5.125, 'OMR', 'smart')).toBe('RO 5.125')
    expect(formatCurrency(2.5, 'XAU', 'smart')).toBe('2.5g')
    expect(formatCurrency(0.00012, 'BTC', 'smart')).toBe(formatCurrency(0.00012, 'BTC'))
  })
})

describe('formatCurrency negative zero', () => {
  it('a tiny negative that rounds to zero carries no sign', () => {
    expect(formatCurrency(-0.004, 'USD')).not.toContain('-')
    expect(formatCurrency(-0.004, 'USD', false)).not.toContain('-')
    expect(formatCurrency(-0.006, 'USD')).toContain('-')
  })
})

describe('currency symbols and decimals (T15)', () => {
  it('uses one symbol per currency, matching the currency catalogue', () => {
    expect(formatCurrency(5, 'OMR', false)).toBe('RO 5')
  })
  it('shows three decimals for 3-decimal currencies', () => {
    expect(formatCurrency(1.5, 'KWD')).toBe('KD 1.500')
    expect(formatCurrency(-2.25, 'BHD')).toBe('-BD 2.250')
    expect(formatCurrency(1.5, 'AED')).toBe('Dh 1.50')
  })
})

describe('formatCompact', () => {
  it('uses Arabic suffixes with Latin digits in ar', () => {
    expect(formatCompact(1500, 'en')).toBe('1.5K')
    const ar = formatCompact(1500, 'ar')
    expect(ar).toMatch(/^1\.5/)
    expect(ar).not.toMatch(/[٠-٩]/)
    expect(ar).toMatch(/[؀-ۿ]/)
  })
})

describe('half-amount rounding is symmetric', () => {
  it('rounds the magnitude, so negatives mirror positives', () => {
    expect(formatMoneyHero(-2.5, 'USD')).toBe('-' + formatMoneyHero(2.5, 'USD'))
    expect(formatMoneyHero(-1234.5, 'USD', { compact: 'off' }).replace(/^-/, '')).toBe(formatMoneyHero(1234.5, 'USD', { compact: 'off' }))
    expect(formatWhole(-2.5)).toBe('-3')
    expect(formatWhole(2.5)).toBe('3')
    expect(formatWhole(-0.4)).toBe('0')
  })
})

describe('formatSignedAuto (QA-91)', () => {
  it('cents only when not whole', async () => {
    const { formatSignedAuto } = await import('./formatters')
    expect(formatSignedAuto(-619.99)).toBe('\u2212619.99')
    expect(formatSignedAuto(1200)).toBe('+1,200')
    expect(formatSignedAuto(0)).toBe('0')
  })
})

describe('formatSignedFlex (QA-121)', () => {
  it('whole when whole, cents when not, true minus for negatives', async () => {
    const { formatSignedFlex } = await import('./formatters')
    expect(formatSignedFlex(-15219.99)).toBe('−15,219.99')
    expect(formatSignedFlex(2400)).toBe('2,400')
    expect(formatSignedFlex(-0.001)).toBe('0')
  })
})
