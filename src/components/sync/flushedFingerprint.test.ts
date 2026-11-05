import { describe, expect, it } from 'vitest'
import { emptySnapshot } from '@/lib/supabase/remote'
import { diffLists } from '@/lib/supabase/remote/diff'
import { baselineFromFingerprint, fingerprintOf } from '@/components/sync/flushedFingerprint'
import type { Expense } from '@/lib/store/types'

const exp = (id: string, amount: number) => ({ id, amount, description: id, category: 'Food', currency: 'EGP', date: '2026-11-05' }) as unknown as Expense

describe('baselineFromFingerprint', () => {
  const serverHad = { ...emptySnapshot(), expenses: [exp('kept', 10), exp('edited', 20), exp('deleted', 30)] }
  const fp = fingerprintOf(serverHad)
  // What the cache holds after offline work: one edit, one new row, one delete, and one row left alone.
  const cache = { ...emptySnapshot(), expenses: [exp('kept', 10), exp('edited', 25), exp('created', 5)] }
  const diff = diffLists(cache.expenses, baselineFromFingerprint(cache, fp).expenses)

  it('sends the row edited offline as an update', () => expect(diff.updates.map((r) => r.id)).toEqual(['edited']))
  it('sends the row created offline as an insert', () => expect(diff.inserts.map((r) => r.id)).toEqual(['created']))
  it('sends the row deleted offline as a delete', () => expect(diff.deletes).toEqual(['deleted']))
  it('sends nothing when the cache is what the server received', () => {
    const same = baselineFromFingerprint(serverHad, fp)
    expect(diffLists(serverHad.expenses, same.expenses)).toEqual({ inserts: [], updates: [], deletes: [] })
  })
  it('re-sends a singleton edited offline', () => {
    const edited = { ...serverHad, financialGoalsNotes: 'new note' }
    expect(baselineFromFingerprint(edited, fp).financialGoalsNotes).not.toBe('new note')
    expect(baselineFromFingerprint(serverHad, fp).financialGoalsNotes).toBe(serverHad.financialGoalsNotes)
  })
  it('does not depend on key order', () => {
    const reordered = { ...serverHad, expenses: serverHad.expenses.map((r) => Object.fromEntries(Object.entries(r).reverse()) as unknown as Expense) }
    expect(diffLists(reordered.expenses, baselineFromFingerprint(reordered, fp).expenses).updates).toEqual([])
  })
})
