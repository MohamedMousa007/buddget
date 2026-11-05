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
