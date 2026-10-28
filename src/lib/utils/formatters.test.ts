import { describe, it, expect } from 'vitest'
import { formatCurrency, formatMoneyHero, formatQuantity, formatWhole } from './formatters'

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
