import { describe, expect, it } from 'vitest'
import { goalAddHint } from './goalAddHint'

describe('BUD-99 goal add hint (target 1000)', () => {
  it('999 → 1 left', () => expect(goalAddHint(0, 1000, 999)).toEqual({ kind: 'left', amount: 1 }))
  it('1000 → reaches the target', () => expect(goalAddHint(400, 1000, 600)).toEqual({ kind: 'exact' }))
  it('1001 → 1 over, never refused', () => expect(goalAddHint(0, 1000, 1001)).toEqual({ kind: 'over', amount: 1 }))
  it('ignores FX dust at the target', () => expect(goalAddHint(999.999, 1000, 0.002)).toEqual({ kind: 'exact' }))
  it('says nothing with no target or no amount', () => {
    expect(goalAddHint(0, null, 10)).toBeNull()
    expect(goalAddHint(0, 0, 10)).toBeNull()
    expect(goalAddHint(0, 1000, 0)).toBeNull()
  })
})
