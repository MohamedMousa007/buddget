import { describe, it, expect } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { sameMerchantTargets } from './sameMerchantApply'

const row = (p: Partial<Expense>) =>
  ({ id: 'a', description: 'Acme Mart', category: 'Other', smsLogId: 's', amount: 1, ...p }) as Expense

describe('sameMerchantTargets', () => {
  const edited = { id: 'x', description: 'Acme Mart', smsLogId: 's' }
  const rows = [row({ id: 'a' }), row({ id: 'b', category: 'Food' })]
  it('targets uncategorised siblings for a spending category', () => {
    expect(sameMerchantTargets(rows, edited, 'Food').map((e) => e.id)).toEqual(['a'])
  })
  it('does nothing for Other, non-spend categories or manual expenses', () => {
    expect(sameMerchantTargets(rows, edited, 'Other')).toEqual([])
    expect(sameMerchantTargets(rows, edited, 'Transfer')).toEqual([])
    expect(sameMerchantTargets(rows, { ...edited, smsLogId: undefined }, 'Food')).toEqual([])
  })
})
