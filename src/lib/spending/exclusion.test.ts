import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { applyMethodExclusion, countedDebtPayments, countedDebts, isMethodExcluded } from './exclusion'

const exp = (id: string, pm: string, extra: Partial<Expense> = {}) => ({ id, paymentMethodId: pm, category: 'Food', ...extra }) as Expense
const NOW = '2026-10-23T00:00:00Z'

describe('method exclusion', () => {
  it('follows the parent account', () => {
    const methods = [{ id: 'a', excluded: true }, { id: 'c', parentId: 'a' }, { id: 'b' }]
    expect(isMethodExcluded(methods, 'c')).toBe(true)
    expect(isMethodExcluded(methods, 'b')).toBe(false)
    expect(isMethodExcluded(methods, 'missing')).toBe(false)
  })
  it('flags the rows of an excluded method and leaves manual choices alone', () => {
    const out = applyMethodExclusion([exp('1', 'a'), exp('2', 'a', { spendExclusion: 'for_someone' }), exp('3', 'b')], [{ id: 'a', excluded: true }, { id: 'b' }], NOW)
    expect(out.map((e) => e.spendExclusion)).toEqual(['method', 'for_someone', undefined])
  })
  it('clears only what the method caused when it is switched back on', () => {
    const rows = [exp('1', 'a', { spendExclusion: 'method' }), exp('2', 'a', { spendExclusion: 'manual' })]
    const out = applyMethodExclusion(rows, [{ id: 'a' }], NOW)
    expect(out[0]!.spendExclusion).toBeUndefined()
    expect(out[1]!.spendExclusion).toBe('manual')
  })
  it('returns the same array when nothing changes', () => {
    const rows = [exp('1', 'b')]
    expect(applyMethodExclusion(rows, [{ id: 'b' }], NOW)).toBe(rows)
  })
})

describe('excluded credit cards', () => {
  const methods = [{ id: 'card', excluded: true }, { id: 'other' }]
  const debts = [
    { id: 'd1', debtType: 'credit_card' as const, linkedPaymentMethodId: 'card' },
    { id: 'd2', debtType: 'credit_card' as const, linkedPaymentMethodId: 'other' },
    { id: 'd3', debtType: 'personal' as const, linkedPaymentMethodId: undefined },
  ]
  it('drops the debt of an excluded card and keeps the rest', () => {
    expect(countedDebts(debts, methods).map((d) => d.id)).toEqual(['d2', 'd3'])
  })
  it('drops that debt\'s payments too', () => {
    const payments = [{ debtId: 'd1' }, { debtId: 'd2' }]
    expect(countedDebtPayments(payments, debts, methods)).toEqual([{ debtId: 'd2' }])
  })
  it('hands back the same array when nothing is excluded, so selectors stay stable', () => {
    const plain = [{ id: 'x' }]
    expect(countedDebts(debts, plain)).toBe(debts)
    expect(countedDebts(debts, plain)).toBe(countedDebts(debts, plain))
  })
})
