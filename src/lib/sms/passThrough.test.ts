import { describe, expect, it } from 'vitest'
import { findPassThroughLegs, findPassThroughPairs, type MoneyLeg } from './passThrough'

const MIN = 60_000
const leg = (id: string, dir: 'in' | 'out', at: number, over: Partial<MoneyLeg> = {}): MoneyLeg => ({ id, owner: 'u1', dir, amount: 1500, currency: 'EGP', account: '1234', at, ...over })

describe('findPassThroughPairs', () => {
  it('pairs money in then the same amount out of one account within the window, in either order', () => {
    expect(findPassThroughPairs([leg('a', 'in', 0), leg('b', 'out', 20_000)])).toEqual([{ inId: 'a', outId: 'b' }])
    expect(findPassThroughPairs([leg('b', 'out', 0), leg('a', 'in', 20_000)])).toEqual([{ inId: 'a', outId: 'b' }])
  })

  it.each([
    ['a different amount', { amount: 1501 }],
    ['a different currency', { currency: 'USD' }],
    ['a different account', { account: '9999' }],
    ['another user', { owner: 'u2' }],
    ['no account on the leg', { account: null }],
  ])('does not pair across %s', (_name, over) => {
    expect(findPassThroughPairs([leg('a', 'in', 0), leg('b', 'out', 20_000, over)])).toEqual([])
  })

  it('never pairs a leg the user chose to count', () => {
    expect(findPassThroughPairs([leg('a', 'in', 0, { counted: true }), leg('b', 'out', 20_000)])).toEqual([])
  })

  it('does not pair legs further apart than the window', () => {
    expect(findPassThroughPairs([leg('a', 'in', 0), leg('b', 'out', 11 * MIN)])).toEqual([])
  })

  it('never pairs two credits or two debits', () => {
    expect(findPassThroughPairs([leg('a', 'in', 0), leg('b', 'in', 1000)])).toEqual([])
    expect(findPassThroughPairs([leg('a', 'out', 0), leg('b', 'out', 1000)])).toEqual([])
  })

  it('uses each leg once and takes the nearest partner', () => {
    const legs = [leg('in1', 'in', 0), leg('out1', 'out', 30_000), leg('in2', 'in', 5 * MIN), leg('out2', 'out', 5 * MIN + 20_000), leg('in3', 'in', 6 * MIN)]
    expect(findPassThroughPairs(legs)).toEqual([{ inId: 'in1', outId: 'out1' }, { inId: 'in2', outId: 'out2' }])
    expect(findPassThroughLegs(legs)).toEqual(new Set(['in1', 'out1', 'in2', 'out2']))
  })
})
