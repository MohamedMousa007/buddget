import { describe, it, expect } from 'vitest'
import { mapKindToCategory, isIncomeKind } from '../createSmsExpense'
import { isNonSpendCategory, CATEGORY_BUDGET_ALIASES } from '@/lib/constants/categoryMeta'
import { resolveBrandKeyFromMerchant } from '@/lib/constants/subscriptionCatalog'

describe('mapKindToCategory', () => {
  it('maps money-movement kinds to fixed non-spend categories', () => {
    expect(mapKindToCategory('atm_withdrawal', null)).toBe('ATM Cash Withdrawal')
    expect(mapKindToCategory('cc_payoff', null)).toBe('CC Payoff')
    expect(mapKindToCategory('own_transfer', null)).toBe('Transfer')
    expect(mapKindToCategory('currency_exchange', null)).toBe('Currency Exchange')
  })

  it('keeps external instant transfers as spend (Remittance)', () => {
    expect(mapKindToCategory('instant_transfer_out', null)).toBe('Remittance')
  })

  it('maps purchase category hints to new spend categories', () => {
    expect(mapKindToCategory('purchase', 'supermarket')).toBe('Groceries')
    expect(mapKindToCategory('purchase', 'petrol station')).toBe('Fuel')
    expect(mapKindToCategory('purchase', 'pharmacy')).toBe('Health')
    expect(mapKindToCategory('online_purchase', 'udemy course')).toBe('Education')
    expect(mapKindToCategory('purchase', 'electricity bill')).toBe('Utilities')
    expect(mapKindToCategory('online_purchase', 'noon')).toBe('Shopping')
    expect(mapKindToCategory('purchase', 'restaurant')).toBe('Food')
  })

  it('falls back to Other for unknown hints', () => {
    expect(mapKindToCategory('purchase', 'random thing')).toBe('Other')
    expect(mapKindToCategory('purchase', null)).toBe('Other')
  })
})

describe('isIncomeKind', () => {
  it('treats only income-bearing kinds as income', () => {
    expect(isIncomeKind('income')).toBe(true)
    expect(isIncomeKind('refund')).toBe(true)
    expect(isIncomeKind('instant_transfer_in')).toBe(true)
    expect(isIncomeKind('own_transfer')).toBe(false)
    expect(isIncomeKind('cc_payoff')).toBe(false)
    expect(isIncomeKind('purchase')).toBe(false)
  })
})

describe('isNonSpendCategory', () => {
  it('flags money movements as non-spend', () => {
    for (const c of ['Savings', 'ATM Cash Withdrawal', 'Transfer', 'Currency Exchange', 'CC Payoff']) {
      expect(isNonSpendCategory(c)).toBe(true)
    }
  })
  it('treats real spend categories as spend', () => {
    for (const c of ['Food', 'Groceries', 'Fuel', 'Subscription', 'Remittance', 'Other']) {
      expect(isNonSpendCategory(c)).toBe(false)
    }
  })
  it('handles null/undefined', () => {
    expect(isNonSpendCategory(null)).toBe(false)
    expect(isNonSpendCategory(undefined)).toBe(false)
  })
})

describe('CATEGORY_BUDGET_ALIASES', () => {
  it('rolls new spend categories into legacy buckets', () => {
    expect(CATEGORY_BUDGET_ALIASES.Food).toContain('Groceries')
    expect(CATEGORY_BUDGET_ALIASES.Transport).toContain('Fuel')
    expect(CATEGORY_BUDGET_ALIASES.Enjoyment).toEqual(expect.arrayContaining(['Shopping', 'Subscription']))
  })
})

describe('resolveBrandKeyFromMerchant', () => {
  it('matches well-known brands by name', () => {
    expect(resolveBrandKeyFromMerchant('NETFLIX.COM')).toBe('netflix')
    expect(resolveBrandKeyFromMerchant('Spotify AB')).toBe('spotify')
  })
  it('resolves aliases that do not contain the brand key', () => {
    expect(resolveBrandKeyFromMerchant('OPENAI *CHATGPT')).toBe('chatgpt_plus')
    expect(resolveBrandKeyFromMerchant('ANTHROPIC')).toBe('claude_pro')
  })
  it('returns null for non-subscription merchants', () => {
    expect(resolveBrandKeyFromMerchant('Carrefour Egypt')).toBeNull()
    expect(resolveBrandKeyFromMerchant(null)).toBeNull()
  })
})
