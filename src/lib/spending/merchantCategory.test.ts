import { describe, it, expect } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { categorySourceAfterSave, isCompanyFormOnly, merchantAnswerRate, merchantKeyOf, sameMerchantUncategorised, unknownMerchants } from './merchantCategory'

let n = 0
function exp(p: Partial<Expense>): Expense {
  n += 1
  return {
    id: `e${n}`,
    date: '2026-01-10',
    description: 'Acme Mart',
    category: 'Other',
    amount: 10,
    currency: 'EGP',
    amountInBaseCurrency: 10,
    smsLogId: 'log',
    ...p,
  } as Expense
}

describe('merchantKeyOf', () => {
  it('folds to lowercase alphanumerics', () => {
    expect(merchantKeyOf('Acme  Mart-2!')).toBe('acmemart2')
  })
  it('is null under 3 characters', () => {
    expect(merchantKeyOf('A.B')).toBeNull()
    expect(merchantKeyOf('  ')).toBeNull()
  })
})

describe('isCompanyFormOnly', () => {
  it('flags cut-off company words', () => {
    expect(isCompanyFormOnly('Establish')).toBe(true)
    expect(isCompanyFormOnly('Company S')).toBe(true)
    expect(isCompanyFormOnly('Enterprises')).toBe(true)
  })
  it('keeps real names and short prefixes', () => {
    expect(isCompanyFormOnly('Acme Trading')).toBe(false)
    expect(isCompanyFormOnly('Com')).toBe(false)
    expect(isCompanyFormOnly('Acme')).toBe(false)
  })
})

describe('sameMerchantUncategorised', () => {
  const edited = { id: 'x', description: 'Acme Mart' }
  it('returns other uncategorised bank-message rows of the same merchant', () => {
    const a = exp({ description: 'ACME MART' })
    const rows = [
      a,
      exp({ description: 'Acme Mart', category: 'Food' }),
      exp({ description: 'Acme Mart', smsLogId: undefined }),
      exp({ description: 'Acme Mart', refundKind: 'refunded' }),
      exp({ description: 'Other Shop' }),
      exp({ id: 'x', description: 'Acme Mart' }),
    ]
    expect(sameMerchantUncategorised(rows, edited)).toEqual([a])
  })
  it('leaves a row the user chose or confirmed as Other alone, and picks one that has no source', () => {
    const open = exp({ description: 'Acme Mart' })
    const rows = [open, exp({ categorySource: 'user_changed' }), exp({ categorySource: 'user_confirmed' })]
    expect(sameMerchantUncategorised(rows, edited)).toEqual([open])
  })
  it('is empty for a null key or company-form name', () => {
    expect(sameMerchantUncategorised([exp({ description: 'Company S' })], { id: 'x', description: 'Company S' })).toEqual([])
    expect(sameMerchantUncategorised([exp({ description: 'ab' })], { id: 'x', description: 'ab' })).toEqual([])
  })
})

describe('unknownMerchants', () => {
  it('does not ask again about a merchant the user already chose Other for', () => {
    expect(unknownMerchants([exp({ categorySource: 'user_changed' }), exp({ categorySource: 'user_confirmed' })], undefined)).toEqual([])
  })
  it('groups, sorts by count then recency, names by latest', () => {
    const rows = [
      exp({ description: 'Acme Mart', date: '2026-01-01' }),
      exp({ description: 'ACME MART', date: '2026-01-05', amount: 5 }),
      exp({ description: 'Beta Shop', date: '2026-01-09' }),
    ]
    const out = unknownMerchants(rows, undefined)
    expect(out.map((g) => g.key)).toEqual(['acmemart', 'betashop'])
    expect(out[0]).toMatchObject({ name: 'ACME MART', total: 15, currency: 'EGP' })
    expect(out[0].ids).toHaveLength(2)
  })
  it('skips answered, company-form, transfers, ATM, refunded, non-positive and non-Other', () => {
    const rows = [
      exp({ description: 'Acme Mart' }),
      exp({ description: 'Establish' }),
      exp({ description: 'Transfer to Sam', category: 'Other' }),
      exp({ description: 'ATM Downtown' }),
      exp({ description: 'Gamma Shop', refundKind: 'declined' }),
      exp({ description: 'Delta Shop', amount: 0 }),
      exp({ description: 'Epsilon Shop', category: 'Instapay' }),
      exp({ description: 'Zeta Shop', smsLogId: undefined }),
    ]
    expect(unknownMerchants(rows, { 'merchantcat:acmemart': 'x' })).toEqual([])
    expect(unknownMerchants(rows, undefined).map((g) => g.key)).toEqual(['acmemart'])
  })
  it('drops mixed-currency groups', () => {
    const rows = [exp({ description: 'Acme Mart' }), exp({ description: 'Acme Mart', currency: 'USD' })]
    expect(unknownMerchants(rows, undefined)).toEqual([])
  })
})

describe('categorySourceAfterSave', () => {
  it('records what the user did with a suggestion', () => {
    expect(categorySourceAfterSave({ category: 'Food', categorySource: 'ai_suggested' }, 'Food')).toBe('user_confirmed')
    expect(categorySourceAfterSave({ category: 'Food', categorySource: 'ai_suggested' }, 'Groceries')).toBe('user_changed')
  })
  it('leaves a row that was never a suggestion as it was', () => {
    expect(categorySourceAfterSave({ category: 'Food' }, 'Groceries')).toBeUndefined()
    expect(categorySourceAfterSave({ category: 'Food', categorySource: 'user_confirmed' }, 'Groceries')).toBe('user_confirmed')
  })
})

describe('merchantAnswerRate', () => {
  it('counts questions closed and questions answered', () => {
    expect(merchantAnswerRate({ 'merchantcat:a': 'x', 'merchantcat:b': 'x', 'merchantcatopen:a': 'x', 'late:1': 'x' })).toEqual({ asked: 2, answered: 1 })
    expect(merchantAnswerRate(undefined)).toEqual({ asked: 0, answered: 0 })
  })
})
