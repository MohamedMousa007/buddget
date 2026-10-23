import { describe, it, expect } from 'vitest'
import { allocateGoalFunding } from '../allocateGoalFunding'
import type { Goal, SavingsAccount } from '@/lib/store/types'

type Row = Record<string, unknown>

/** In-memory stand-in for the slice of the Supabase client the allocator uses. */
function fakeService(seed: Record<string, Row[]>, opts: { failInsert?: string } = {}) {
  const db: Record<string, Row[]> = JSON.parse(JSON.stringify(seed))
  let id = 0
  const from = (table: string) => {
    const st = { action: 'select', filters: [] as [string, unknown][], row: null as Row | null, patch: null as Row | null, one: false }
    const rows = () => (db[table] ??= [])
    const match = (r: Row) => st.filters.every(([k, v]) => r[k] === v)
    const run = (): { data: unknown; error: { code: string } | null } => {
      if (st.action === 'insert') {
        if (opts.failInsert === table) return { data: null, error: { code: 'boom' } }
        const row: Row = { id: `${table}-${++id}`, ...st.row }
        if (table === 'goal_allocation_runs' && rows().some((r) => r.goal_id === row.goal_id && r.period === row.period)) {
          return { data: null, error: { code: '23505' } }
        }
        rows().push(row)
        return { data: row, error: null }
      }
      if (st.action === 'update') {
        rows().filter(match).forEach((r) => Object.assign(r, st.patch))
        return { data: null, error: null }
      }
      if (st.action === 'delete') {
        db[table] = rows().filter((r) => !match(r))
        return { data: null, error: null }
      }
      const found = rows().filter(match)
      return { data: st.one ? (found[0] ?? null) : found, error: null }
    }
    const q = {
      select: () => q,
      insert: (row: Row) => ((st.action = 'insert'), (st.row = row), q),
      update: (patch: Row) => ((st.action = 'update'), (st.patch = patch), q),
      delete: () => ((st.action = 'delete'), q),
      eq: (k: string, v: unknown) => (st.filters.push([k, v]), q),
      is: () => q, in: () => q, not: () => q, order: () => q, limit: () => q,
      single: () => ((st.one = true), Promise.resolve(run())),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    }
    return q
  }
  // adjust_pocket_balance: atomic and idempotent per group id, like the SQL function.
  const rpc = (fn: string, a: Record<string, unknown>) => {
    if (fn !== 'adjust_pocket_balance') return Promise.resolve({ data: null, error: { message: 'unknown rpc' } })
    if (opts.failInsert === 'savings_transactions') return Promise.resolve({ data: null, error: { message: 'boom' } })
    const txs = (db.savings_transactions ??= [])
    if (txs.some((t) => t.account_id === a.p_pocket && t.transfer_group_id === a.p_group)) return Promise.resolve({ data: null, error: null })
    const acc = (db.savings_accounts ??= []).find((r) => r.id === a.p_pocket)
    if (!acc) return Promise.resolve({ data: null, error: { message: 'pocket not found' } })
    acc.current_balance = Number(acc.current_balance ?? 0) + Number(a.p_delta)
    txs.push({ id: `savings_transactions-${++id}`, account_id: a.p_pocket, transfer_group_id: a.p_group, amount: a.p_delta, source: a.p_source, payment_method_id: a.p_payment_method })
    return Promise.resolve({ data: acc.current_balance, error: null })
  }
  return { service: { from, rpc } as never, db }
}

const goal = (id: string, priority: number, sharePct: number, over: Partial<Goal> = {}): Goal => ({
  id, name: id, emoji: '', category: 'vacation', targetAmount: 100000, currency: 'EGP', manualCurrentAmount: 0,
  targetDate: '2027-10-01', linkedSavingsAccountIds: [`p-${id}`], linkedDebtIds: [], monthlySpendingLimit: null,
  priority, status: 'active', monthlyContribution: null, fundingMode: 'share', sharePct, frequency: 'monthly',
  planStart: null, notes: null, createdAt: '2026-01-01', achievedAt: null, ...over,
})
const pocket = (id: string): SavingsAccount =>
  ({ id: `p-${id}`, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance: 0, createdAt: 'x' }) as SavingsAccount

const base = { userId: 'u', monthKey: '2026-09', base: 'EGP' as const, rates: {}, postDate: '2026-09-30' }
const seed = (): Record<string, Row[]> => ({
  savings_accounts: [{ id: 'p-a', current_balance: 0 }, { id: 'p-b', current_balance: 0 }],
})

describe('allocateGoalFunding', () => {
  const goals = [goal('a', 0, 60), goal('b', 1, 75)]
  const accounts = [pocket('a'), pocket('b')]

  it('pays by priority, records runs and returns what is left', async () => {
    const { service, db } = fakeService(seed())
    const left = await allocateGoalFunding({ ...base, service, carry: 1000, goals, accounts })
    expect(left).toBe(0)
    expect(db.goal_allocation_runs.map((r) => [r.goal_id, r.planned, r.amount])).toEqual([['a', 600, 600], ['b', 750, 400]])
    expect(db.savings_accounts.map((r) => r.current_balance)).toEqual([600, 400])
    expect(db.savings_transactions).toHaveLength(2)
  })

  it('a rerun of the same cycle moves no money and reports the same remainder', async () => {
    const { service, db } = fakeService(seed())
    const first = await allocateGoalFunding({ ...base, service, carry: 1000, goals: [goal('a', 0, 30)], accounts })
    const again = await allocateGoalFunding({ ...base, service, carry: 1000, goals: [goal('a', 0, 30)], accounts })
    expect(first).toBe(700)
    expect(again).toBe(700)
    expect(db.savings_transactions).toHaveLength(1)
    expect(db.savings_accounts[0].current_balance).toBe(300)
  })

  it('a rerun after a half-finished cycle does not sweep the paid goal\'s money again', async () => {
    const { service, db } = fakeService(seed())
    db.goal_allocation_runs = [{ goal_id: 'a', period: '2026-09', planned: 600, amount: 600, user_id: 'u' }]
    const left = await allocateGoalFunding({ ...base, service, carry: 1000, goals, accounts })
    expect(left).toBe(0)
    expect(db.goal_allocation_runs.filter((r) => r.goal_id === 'b')[0].amount).toBe(400)
    expect(db.savings_transactions).toHaveLength(1)
  })

  it('a failed deposit releases its claim and keeps the money for the sweep', async () => {
    const { service, db } = fakeService(seed(), { failInsert: 'savings_transactions' })
    const left = await allocateGoalFunding({ ...base, service, carry: 1000, goals: [goal('a', 0, 50)], accounts })
    expect(left).toBe(1000)
    expect(db.goal_allocation_runs ?? []).toHaveLength(0)
    expect(db.savings_accounts[0].current_balance).toBe(0)
  })

  it('records a missed cycle when there is nothing to allocate', async () => {
    const { service, db } = fakeService(seed())
    const left = await allocateGoalFunding({ ...base, service, carry: 0, goals: [goal('a', 0, 50)], accounts })
    expect(left).toBe(0)
    expect(db.goal_allocation_runs).toMatchObject([{ goal_id: 'a', planned: 0, amount: 0 }])
  })

  it('quarterly goals are funded monthly, fixed amounts split across the quarter', async () => {
    const { service, db } = fakeService(seed())
    await allocateGoalFunding({
      ...base, service, carry: 1000, accounts,
      goals: [goal('a', 0, 0, { fundingMode: 'fixed', frequency: 'quarterly', monthlyContribution: 900, sharePct: null })],
    })
    expect(db.goal_allocation_runs[0]).toMatchObject({ planned: 300, amount: 300 })
  })

  it('reports each checkpoint crossed and completion', async () => {
    const { service } = fakeService(seed())
    const hits: number[] = []
    await allocateGoalFunding({
      ...base, service, carry: 1000, accounts,
      goals: [goal('a', 0, 100, { targetAmount: 1000, manualCurrentAmount: 0 })],
      onCheckpoint: async (_g, pct) => void hits.push(pct),
    })
    expect(hits).toEqual([25, 50, 75, 100])
  })

  it('creates and links a pocket when the goal has none', async () => {
    const { service, db } = fakeService({ ...seed(), goals: [{ id: 'a', linked_savings_account_ids: [] }] })
    await allocateGoalFunding({ ...base, service, carry: 500, accounts: [], goals: [goal('a', 0, 100, { linkedSavingsAccountIds: [] })] })
    const created = db.savings_accounts.find((r) => r.name === 'a pocket')!
    expect(created.current_balance).toBe(500)
    expect((db.goals[0].linked_savings_account_ids as string[])).toEqual([created.id])
  })
})
