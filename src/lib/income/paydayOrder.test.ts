import { describe, it, expect } from 'vitest'
import { moveInOrder, sortOrderPatches } from '@/lib/income/paydayOrder'

describe('payday reorder (restored on the Light touch Paydays page)', () => {
  it('moves a payday up or down, clamped to the ends', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(moveInOrder(['a', 'b', 'c'], 'a', 5)).toEqual(['b', 'c', 'a'])
    expect(moveInOrder(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
  })

  it('returns the same order when nothing moves or the id is unknown', () => {
    const o = ['a', 'b']
    expect(moveInOrder(o, 'a', 0)).toBe(o)
    expect(moveInOrder(o, 'z', 1)).toBe(o)
  })

  it('writes sortOrder only for paydays whose place changed', () => {
    expect(sortOrderPatches(['b', 'a', 'c'], [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }, { id: 'c', sortOrder: 2 }]))
      .toEqual([{ id: 'b', sortOrder: 0 }, { id: 'a', sortOrder: 1 }])
    expect(sortOrderPatches(['a', 'b'], [{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }])
  })
})
