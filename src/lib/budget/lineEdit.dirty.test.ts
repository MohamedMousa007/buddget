import { describe, expect, it } from 'vitest'
import { lineEditDirty, type LineEditState } from '@/lib/budget/lineEdit'

const from: LineEditState = { amount: 1200, essential: false, locked: false, dueDay: 5, categories: ['Food'] }

describe('line sheet Save', () => {
  it('stays off until something changes', () => {
    expect(lineEditDirty(from, { ...from }, false)).toBe(false)
    expect(lineEditDirty(from, { ...from, amount: 1300 }, false)).toBe(true)
    expect(lineEditDirty(from, { ...from, dueDay: null }, false)).toBe(true)
    expect(lineEditDirty(from, { ...from, categories: ['Food', 'Groceries'] }, false)).toBe(true)
    expect(lineEditDirty(from, { ...from, locked: true }, false)).toBe(true)
  })
  it('a linked line’s amount is not editable, so it does not count', () => {
    expect(lineEditDirty(from, { ...from, amount: 1300 }, true)).toBe(false)
  })
})
