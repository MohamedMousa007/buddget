import { beforeEach, describe, expect, it, vi } from 'vitest'
import { at, expense, fixture, type World } from '@/lib/monthEnd/__tests__/fixtureF'
import type { DueUser, MonthEndLedger, SummaryRow } from '../monthEndLedger'

/**
 * The month-end orchestration (propose / apply) against an in-memory savings_month_summary and RPCs that keep the
 * SQL contract of 0362: apply_month_end compares status and version (CAS) and writes one label per line. The pure
 * placement is covered in src/lib/monthEnd; this checks what the server sends and that one card applies once (T33).
 */
const h = vi.hoisted(() => ({ world: null as unknown as World, split: [] as unknown, due: null as unknown as DueUser, rows: [] as SummaryRow[] }))
vi.mock('../monthEndLedger', async (orig) => ({
  ...(await orig<typeof import('../monthEndLedger')>()),
  dueUsers: async () => ({ users: [h.due], nextAfter: null }),
  loadMonthEndLedger: async (): Promise<MonthEndLedger> => ({
    base: 'EGP', profileCreatedAt: '2025-10-01T00:00:00.000Z', savingsSplit: h.split, truncated: false,
    ledger: h.world.ledger, goals: h.world.goals, summaries: h.rows,
  }),
}))

import { applyMonthEnd, proposeMonthEnd } from '../monthEnd'

const LIVE = { USD_EGP: 50 }
const DEC1 = at(12, 1, 9)
const db = { get rows() { return h.rows }, set rows(v: SummaryRow[]) { h.rows = v }, labels: [] as { part: string; amount: number }[], applyCalls: [] as Record<string, unknown>[] }

/** Only the calls monthEnd.ts makes, with PostgREST's chaining. */
function fakeService() {
  const table = () => {
    const filters: ((r: SummaryRow) => boolean)[] = []
    let patch: Partial<SummaryRow> | null = null
    const q = {
      select: () => q,
      eq: (col: keyof SummaryRow, v: unknown) => { filters.push((r) => r[col] === v); return q },
      not: (col: keyof SummaryRow) => { filters.push((r) => r[col] != null); return q },
      order: () => q,
      limit: () => q,
      in: () => q,
      is: () => q,
      gt: () => q,
      update: (p: Partial<SummaryRow>) => { patch = p; return q },
      insert: async (row: Partial<SummaryRow>) => {
        if (db.rows.some((r) => r.user_id === row.user_id && r.month_key === row.month_key)) return { error: { code: '23505', message: 'dup' } }
        db.rows.push({ id: `row-${db.rows.length + 1}`, created_at: new Date(DEC1).toISOString(), version: 1, applied_lines: null, applied_at: null, applied_by: null, achieved_by_proposal: [], ...row } as SummaryRow)
        return { error: null }
      },
      maybeSingle: async () => {
        const hits = db.rows.filter((r) => filters.every((f) => f(r))).sort((a, b) => String(b.cycle_end).localeCompare(String(a.cycle_end)))
        if (patch) for (const r of hits) Object.assign(r, patch)
        return { data: hits[0] ? { ...hits[0] } : null, error: null }
      },
    }
    return q
  }
  return {
    from: () => table(),
    rpc: async (name: string, a: Record<string, unknown>) => {
      if (name !== 'apply_month_end') throw new Error(name)
      db.applyCalls.push(a)
      await Promise.resolve()
      const row = db.rows.find((r) => r.id === a.p_id)!
      if (row.status !== 'proposed' || row.version !== a.p_version) return { data: { outcome: 'conflict' }, error: null }
      for (const l of a.p_lines as { part_id: string; amount: number }[]) db.labels.push({ part: l.part_id, amount: l.amount })
      Object.assign(row, { status: 'applied', version: row.version + 1, applied_lines: a.p_lines, applied_at: new Date().toISOString(), applied_by: a.p_by })
      return { data: { outcome: 'applied' }, error: null }
    },
  } as never
}

const dueNov = (): DueUser => ({
  userId: 'u1', monthStartDay: 1, timezone: 'Africa/Cairo', language: 'en', today: '2025-12-01',
  latestStart: null, latestEnd: null, due: true, dueStart: '2025-11-01', dueEnd: '2025-12-01',
})

beforeEach(() => {
  db.rows = []
  db.labels = []
  db.applyCalls = []
  h.world = fixture()
  h.split = [{ target_id: 'car', pct: 50 }, { target_id: 'travel', pct: 20 }]
  h.due = dueNov()
})

describe('propose', () => {
  it('T26: one proposed row for Nov (key = cycle start), auto-apply 72 h later, the T26 lines', async () => {
    const v = await proposeMonthEnd(fakeService(), 'u1', LIVE, DEC1)
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0]).toMatchObject({ month_key: '2025-11-01', status: 'proposed', cycle_start: '2025-11-01', cycle_end: '2025-12-01', rates: { USD: 50 } })
    expect(db.rows[0].auto_apply_at).toBe(new Date(DEC1 + 72 * 3600 * 1000).toISOString())
    expect(v?.figures).toMatchObject({ income: 75000, spending: 37000, savedNet: 5000, leftover: 33000, placeable: 33000, notPlaced: 0 })
    expect(v?.lines.map((l) => [l.kind, l.targetId, l.accountId, l.amount])).toEqual([['goal', 'car', 'CIB', 16500], ['pocket', 'travel', 'CIB', 6600], ['ms', null, 'CIB', 9900]])
  })

  it('T30: a negative month is recorded empty, with nothing to set aside', async () => {
    h.world.ledger.expenses.push(expense('more', 43000, 'CIB', '2025-11-26'))
    const v = await proposeMonthEnd(fakeService(), 'u1', LIVE, DEC1)
    expect(v).toMatchObject({ status: 'empty', lines: [] })
    expect(v?.figures.leftover).toBe(-10000)
  })

  it('N10: a split change re-proposes the pending row (version 2), auto_apply_at unchanged', async () => {
    const service = fakeService()
    await proposeMonthEnd(service, 'u1', LIVE, DEC1)
    const autoApply = db.rows[0].auto_apply_at
    h.split = [{ target_id: 'car', pct: 30 }, { target_id: 'travel', pct: 20 }]
    h.due = { ...dueNov(), due: false, latestStart: '2025-11-01', latestEnd: '2025-12-01', today: '2025-12-02' }
    const v = await proposeMonthEnd(service, 'u1', LIVE, at(12, 2))
    expect(v).toMatchObject({ version: 2, autoApplyAt: autoApply })
    expect(v?.lines.map((l) => [l.targetId, l.amount])).toEqual([['car', 9900], ['travel', 6600], [null, 16500]])
  })

  it('T47: an applied month is returned as it was (no re-price, no write)', async () => {
    const service = fakeService()
    await proposeMonthEnd(service, 'u1', LIVE, DEC1)
    await applyMonthEnd(service, 'u1', db.rows[0].id, 1, 'user', LIVE, at(12, 1, 10))
    const before = JSON.stringify(db.rows[0])
    h.due = { ...dueNov(), due: false, latestStart: '2025-11-01', latestEnd: '2025-12-01', today: '2025-12-05' }
    const v = await proposeMonthEnd(service, 'u1', { USD_EGP: 45 }, at(12, 5))
    expect(JSON.stringify(db.rows[0])).toBe(before)
    expect(v).toMatchObject({ status: 'applied', figures: { income: 75000 } })
    expect(db.rows[0].rates).toEqual({ USD: 50 })
  })
})

describe('apply', () => {
  it('T33: Confirm and the auto-apply both send version 1: one applied, one conflict, one set of labels', async () => {
    const service = fakeService()
    await proposeMonthEnd(service, 'u1', LIVE, DEC1)
    const id = db.rows[0].id
    const [a, b] = await Promise.all([
      applyMonthEnd(service, 'u1', id, 1, 'user', LIVE, at(12, 4)),
      applyMonthEnd(service, 'u1', id, 1, 'auto', LIVE, at(12, 4)),
    ])
    expect([a.outcome, b.outcome].sort()).toEqual(['applied', 'conflict'])
    expect(db.labels).toEqual([{ part: 'carCIB', amount: 16500 }, { part: 'travel', amount: 6600 }, { part: 'ms', amount: 9900 }])
    expect(db.rows[0]).toMatchObject({ status: 'applied', version: 2 })
  })

  it('sends held per account for the recheck and flags a goal the lines complete (T29)', async () => {
    h.world.goals[0].targetAmount = 40000
    const service = fakeService()
    await proposeMonthEnd(service, 'u1', LIVE, DEC1)
    await applyMonthEnd(service, 'u1', db.rows[0].id, 1, 'user', LIVE, at(12, 1, 10))
    const call = db.applyCalls[0] as { p_held: Record<string, number>; p_lines: { target_id: string | null; completes_goal?: boolean }[]; p_rates: unknown }
    expect(call.p_held).toEqual({ CIB: 28000, Deel: 200, Cash: 0, NBE: 0 })
    expect(call.p_lines.find((l) => l.target_id === 'car')?.completes_goal).toBe(true)
    expect(call.p_rates).toEqual({ USD: 50 })
  })

  it('a replay of an apply that landed (version + 1, applied) is that apply\'s success', async () => {
    const service = fakeService()
    await proposeMonthEnd(service, 'u1', LIVE, DEC1)
    await applyMonthEnd(service, 'u1', db.rows[0].id, 1, 'user', LIVE, at(12, 1, 10))
    expect((await applyMonthEnd(service, 'u1', db.rows[0].id, 1, 'user', LIVE)).outcome).toBe('applied')
    expect(db.labels).toHaveLength(3)
  })

  it('a stale version is refused before the transaction', async () => {
    const service = fakeService()
    await proposeMonthEnd(service, 'u1', LIVE, DEC1)
    expect((await applyMonthEnd(service, 'u1', db.rows[0].id, 7, 'user', LIVE)).outcome).toBe('conflict')
    expect(db.applyCalls).toHaveLength(0)
  })
})
