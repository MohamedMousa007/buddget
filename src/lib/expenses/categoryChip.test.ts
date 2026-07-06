import { describe, it, expect } from 'vitest'
import { categoryChipColors } from './categoryChip'
import type { ExpenseCategory } from '@/lib/store/types'

const NEUTRAL_FG = 'var(--cat-neutral-fg)'

// Every ExpenseCategory member except 'Other' must get a distinct color chip —
// this is what fixed the "pale"/all-grey expense list.
const CATEGORIES: ExpenseCategory[] = [
  'Rent', 'Transport', 'Food', 'Enjoyment', 'Savings', 'Debt', 'Remittance',
  'Groceries', 'Fuel', 'Health', 'Shopping', 'Education', 'Utilities', 'Subscription',
  'ATM Cash Withdrawal', 'Transfer', 'Currency Exchange', 'CC Payoff',
]

describe('categoryChipColors', () => {
  it('gives every non-Other category a colored (non-neutral) chip', () => {
    for (const cat of CATEGORIES) {
      expect(categoryChipColors(cat).fg, cat).not.toBe(NEUTRAL_FG)
    }
  })

  it('falls back to neutral for Other and unknown values', () => {
    expect(categoryChipColors('Other').fg).toBe(NEUTRAL_FG)
    expect(categoryChipColors('').fg).toBe(NEUTRAL_FG)
    expect(categoryChipColors('Zzz Nonsense').fg).toBe(NEUTRAL_FG)
  })

  it('normalizes spacing/case for multi-word categories', () => {
    expect(categoryChipColors('atm cash withdrawal')).toEqual(categoryChipColors('ATM Cash Withdrawal'))
  })

  it('returns a CSS custom property reference, resolvable per-theme', () => {
    expect(categoryChipColors('Rent').fg).toMatch(/^var\(--cat-.+-fg\)$/)
    expect(categoryChipColors('Rent').bg).toMatch(/^var\(--cat-.+-bg\)$/)
  })
})
