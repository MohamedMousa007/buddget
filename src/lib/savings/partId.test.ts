import { describe, expect, it } from 'vitest'
import { partId, sha256Hex } from './partId'
import { covered, uncoverOrder } from './labels'
import type { SavingsAccount } from '@/lib/store/types'

describe('partId (layout fixed: P6 derives the same ids)', () => {
  it('SHA-256 matches the standard vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('a'.repeat(200))).toBe('c2a908d98f5df987ade41b5fce213067efbcc21ef2240212a41e54b5e7c28ae5')
  })
  it('part|<goal>|<account> → first 16 bytes, version 8, RFC variant', () => {
    expect(sha256Hex('part|g1|a1').slice(0, 32)).toBe('b5204031c4fd4290622e439c8ce43c5a')
    expect(partId({ goalId: 'g1' }, 'a1')).toBe('b5204031-c4fd-8290-a22e-439c8ce43c5a')
    expect(partId({ monthlySavingsOf: 'u' }, 'a1')).toBe(partId({ goalId: 'ms:u' }, 'a1'))
  })
})

describe('uncoverOrder and covered (§4.2, T10/T11 numbers)', () => {
  const p = (id: string, bal: number, over: Partial<SavingsAccount> = {}) =>
    ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance: bal, createdAt: '2025-11-01', heldInPaymentMethodId: 'CIB', ...over }) as SavingsAccount
  const parts = [p('car', 20000, { goalId: 'car' }), p('travel', 5000), p('ms', 3000, { isMonthlySavings: true })]
  const goals = [{ id: 'car', priority: 1, status: 'active' as const }]
  it('Monthly savings, then pockets, then goal parts', () => {
    expect(uncoverOrder(parts, 'CIB', goals).map((x) => x.id)).toEqual(['ms', 'travel', 'car'])
  })
  it('short 8,000 uncovers MS and Travel; short 10,000 leaves Car 18,000', () => {
    const order = uncoverOrder(parts, 'CIB', goals)
    expect(Object.fromEntries(covered(order, 8000))).toEqual({ ms: 0, travel: 0, car: 20000 })
    expect(covered(order, 10000).get('car')).toBe(18000)
  })
})
