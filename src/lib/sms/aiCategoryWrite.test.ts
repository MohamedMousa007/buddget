import { describe, expect, it } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { applyAiCategory, mayServerCategorise } from './aiCategoryWrite'

type Row = Record<string, unknown>

/** Filters really filter, so a write that ignores the predicate changes a row the test says it must not. */
function memExpenses(rows: Row[]): ServiceClient {
  const from = () => {
    const filters: ((r: Row) => boolean)[] = []
    let patch: Row = {}
    const b: Record<string, unknown> = {
      update: (p: Row) => ((patch = p), b),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      is: (c: string, v: unknown) => (filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
      not: (c: string, _o: string, v: unknown) => (filters.push((r) => (v === null ? r[c] != null : r[c] !== v)), b),
      ilike: (c: string, v: string) => (filters.push((r) => String(r[c]).toLowerCase() === v.toLowerCase()), b),
      then: (res: (v: unknown) => unknown) => {
        rows.filter((r) => filters.every((f) => f(r))).forEach((r) => Object.assign(r, patch))
        return res({ error: null })
      },
    }
    return b
  }
  return { from } as unknown as ServiceClient
}

const exp = (id: string, category: string, source: string | null, extra: Row = {}): Row =>
  ({ id, user_id: 'u1', description: 'Test Shop', category, category_source: source, sms_log_id: `log-${id}`, deleted_at: null, refunded_at: null, ...extra })

describe('mayServerCategorise (P2-2)', () => {
  it('is true only for Other with no source', () => {
    expect(mayServerCategorise({ category: 'Other', category_source: null })).toBe(true)
    expect(mayServerCategorise({ category: 'Other', category_source: 'user_confirmed' })).toBe(false)
    expect(mayServerCategorise({ category: 'Other', category_source: 'user_changed' })).toBe(false)
    expect(mayServerCategorise({ category: 'Other', category_source: 'ai_suggested' })).toBe(false)
    expect(mayServerCategorise({ category: 'Food', category_source: null })).toBe(false)
  })
})

describe('applyAiCategory', () => {
  it('categorises the new row and earlier uncategorised rows of the same merchant as suggestions', async () => {
    const rows = [exp('new', 'Other', null), exp('old', 'Other', null)]
    await applyAiCategory(memExpenses(rows), { userId: 'u1', expenseId: 'new', merchant: 'Test Shop', category: 'Shopping' })
    expect(rows.map((r) => [r.category, r.category_source])).toEqual([['Shopping', 'ai_suggested'], ['Shopping', 'ai_suggested']])
  })

  it('does not overwrite a category the user chose while the AI call was running, on the new row', async () => {
    const rows = [exp('new', 'Other', 'user_changed')]
    await applyAiCategory(memExpenses(rows), { userId: 'u1', expenseId: 'new', merchant: 'Test Shop', category: 'Shopping' })
    expect(rows[0]).toMatchObject({ category: 'Other', category_source: 'user_changed' })
  })

  it('leaves an earlier row the user chose Other for, and one they confirmed, alone', async () => {
    const rows = [exp('new', 'Other', null), exp('chose', 'Other', 'user_changed'), exp('confirmed', 'Other', 'user_confirmed'), exp('guess', 'Food', 'ai_suggested')]
    await applyAiCategory(memExpenses(rows), { userId: 'u1', expenseId: 'new', merchant: 'Test Shop', category: 'Shopping' })
    expect(rows.map((r) => r.category)).toEqual(['Shopping', 'Other', 'Other', 'Food'])
    expect(rows.map((r) => r.category_source)).toEqual(['ai_suggested', 'user_changed', 'user_confirmed', 'ai_suggested'])
  })

  it("does not touch another user's rows or refunded and deleted ones", async () => {
    const rows = [exp('new', 'Other', null), exp('theirs', 'Other', null, { user_id: 'u2' }), exp('gone', 'Other', null, { deleted_at: '2026-10-01' }), exp('refunded', 'Other', null, { refunded_at: '2026-10-01' })]
    await applyAiCategory(memExpenses(rows), { userId: 'u1', expenseId: 'new', merchant: 'Test Shop', category: 'Shopping' })
    expect(rows.map((r) => r.category)).toEqual(['Shopping', 'Other', 'Other', 'Other'])
  })

  it('does not spread to a bare company-form word', async () => {
    const rows = [exp('new', 'Other', null, { description: 'Establishment' }), exp('old', 'Other', null, { description: 'Establishment' })]
    await applyAiCategory(memExpenses(rows), { userId: 'u1', expenseId: 'new', merchant: 'Establishment', category: 'Shopping' })
    expect(rows.map((r) => r.category)).toEqual(['Shopping', 'Other'])
  })
})
