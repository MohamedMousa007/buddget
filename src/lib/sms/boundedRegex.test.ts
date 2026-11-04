import { describe, expect, it } from 'vitest'
import { execBounded } from './boundedRegex'
import { applyMappingRules } from './templateApply'

describe('execBounded', () => {
  it('returns a normal match with groups and spans', () => {
    const m = execBounded('EGP\\s*([\\d,.]+)', 'd', 'Purchase EGP 925.00 at SHOP')
    expect(m?.[1]).toBe('925.00')
    expect((m as RegExpExecArray & { indices?: unknown[] }).indices).toBeDefined()
  })
  it('returns null when nothing matches', () => {
    expect(execBounded('xyz', '', 'abc')).toBeNull()
  })
  it('stops catastrophic backtracking instead of stalling the thread', () => {
    const t = Date.now()
    expect(() => execBounded('\\d+\\d+\\d+x', '', '1'.repeat(1000))).toThrow()
    expect(Date.now() - t).toBeLessThan(1000)
  })
})

describe('applyMappingRules with a slow template', () => {
  it('returns null quickly for an overlapping-quantifier pattern', () => {
    const t = Date.now()
    const out = applyMappingRules('1'.repeat(1500), '\\d+\\d+\\d+x', { amount: { group: 1 } } as never)
    expect(out).toBeNull()
    expect(Date.now() - t).toBeLessThan(1000)
  })
})
