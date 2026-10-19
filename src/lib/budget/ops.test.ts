import { describe, expect, it } from 'vitest'
import { applyOps, diffLines } from '@/lib/budget/ops'
import type { BudgetPlanCategory } from '@/lib/store/types'

const line = (over: Partial<BudgetPlanCategory> & { id: string; name: string }): BudgetPlanCategory => ({
  icon: 'wallet', amount: 100, subcategories: [], block: 'everyday', linkType: 'none', locked: false, ...over,
})
const before = [
  line({ id: 'g', name: 'Groceries', amount: 2100 }),
  line({ id: 'd', name: 'Dining', amount: 1000, locked: true }),
  line({ id: 's', name: 'Subscriptions', amount: 412, block: 'subscriptions', linkType: 'subscriptions' }),
]
let n = 0
const opts = { newId: () => `new${++n}`, maxAmount: 50_000 }

describe('applyOps', () => {
  it('sets, adds, renames and removes in order', () => {
    const r = applyOps(before, [
      { op: 'set', id: 'g', amount: 1900 },
      { op: 'add', line: { block: 'everyday', name: 'Gym', icon: 'dumbbell', amount: 200 } },
      { op: 'rename', id: 'g', name: 'Food shop' },
    ], opts)
    expect(r.rejected).toEqual([])
    expect(r.lines.find((c) => c.id === 'g')).toMatchObject({ amount: 1900, name: 'Food shop' })
    expect(r.lines.at(-1)).toMatchObject({ name: 'Gym', block: 'everyday', locked: false, linkType: 'none' })
  })
  it('never touches locked or linked lines', () => {
    const r = applyOps(before, [
      { op: 'set', id: 'd', amount: 0 },
      { op: 'remove', id: 'd' },
      { op: 'set', id: 's', amount: 1 },
      { op: 'move', id: 's', block: 'grow' },
    ], opts)
    expect(r.rejected.map((x) => x.reason)).toEqual(['locked', 'locked', 'linked', 'linked'])
    expect(r.lines).toEqual(before)
  })
  it('rejects unknown ids, bad amounts and duplicate names', () => {
    const r = applyOps(before, [
      { op: 'set', id: 'nope', amount: 1 },
      { op: 'set', id: 'g', amount: -5 },
      { op: 'set', id: 'g', amount: 99_999 },
      { op: 'set', id: 'g', amount: Number.NaN },
      { op: 'add', line: { block: 'everyday', name: 'groceries', icon: 'wallet', amount: 1 } },
    ], opts)
    expect(r.rejected.map((x) => x.reason)).toEqual(['unknown', 'invalid', 'invalid', 'invalid', 'duplicate'])
  })
  it('lock can toggle a locked line and then it is protected', () => {
    const r = applyOps(before, [{ op: 'lock', id: 'g', locked: true }, { op: 'set', id: 'g', amount: 1 }], opts)
    expect(r.rejected).toHaveLength(1)
    expect(applyOps(before, [{ op: 'lock', id: 'd', locked: false }, { op: 'set', id: 'd', amount: 5 }], opts).rejected).toEqual([])
  })
  it('does not mutate the input and reports a diff for undo previews', () => {
    const snapshot = JSON.stringify(before)
    const r = applyOps(before, [{ op: 'set', id: 'g', amount: 1900 }, { op: 'remove', id: 'g' }], opts)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(r.diff).toEqual([expect.objectContaining({ id: 'g', kind: 'removed', delta: -2100 })])
  })
})

describe('diffLines', () => {
  it('classifies changed, moved, added and removed', () => {
    const after = [
      line({ id: 'g', name: 'Groceries', amount: 2000 }),
      line({ id: 'd', name: 'Dining', amount: 1000, locked: true, block: 'grow' }),
      line({ id: 'x', name: 'New', amount: 50 }),
    ]
    const d = diffLines(before, after)
    expect(d.map((x) => [x.id, x.kind, x.delta])).toEqual([['g', 'changed', -100], ['d', 'moved', 0], ['x', 'added', 50], ['s', 'removed', -412]])
  })
})
