import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  db: {} as Record<string, Row[]>,
  rpcs: [] as Row[],
  figs: {} as Record<string, { income: number; spend: number; allocated: number } | null>,
  userId: 'u1' as string | null,
  failRpc: false,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/allocateGoalFunding', () => ({ allocateGoalFunding: async ({ carry }: { carry: number }) => carry }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: async () => undefined }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: async () => false }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: async () => h.userId }))
vi.mock('@/lib/savings/cycleCarryFigures', () => ({ cycleCarryFigures: (i: { monthKey: string }) => h.figs[i.monthKey] ?? null }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: fake, rpc }) }))

function rpc(name: string, a: Row) {
  if (name !== 'adjust_pocket_balance' || h.failRpc) return Promise.resolve({ data: null, error: { message: 'unknown rpc' } })
  const txs = (h.db.savings_transactions ??= [])
  if (txs.some((t) => t.account_id === a.p_pocket && t.transfer_group_id === a.p_group)) return Promise.resolve({ data: null, error: null })
  const acc = h.db.savings_accounts!.find((r) => r.id === a.p_pocket)!
  acc.current_balance = Number(acc.current_balance) + Number(a.p_delta)
  txs.push({ account_id: a.p_pocket, transfer_group_id: a.p_group, amount: Math.abs(Number(a.p_delta)) })
  h.rpcs.push(a)
  return Promise.resolve({ data: acc.current_balance, error: null })
}

/** A small PostgREST stand-in that honours eq/lt/is filters, order, limit, insert and update against `h.db`. */
function fake(table: string) {
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  let limit = Infinity
  let sort: { col: string; asc: boolean } | null = null
  let range: [number, number] | null = null
  const run = () => {
    const rows = (h.db[table] ??= [])
    if (op === 'insert') { rows.push({ id: `${table}-${rows.length}`, ...payload }); return [rows[rows.length - 1]!] }
    const hit = rows.filter((r) => filters.every((f) => f(r)))
    if (op === 'update') { hit.forEach((r) => Object.assign(r, payload, table === 'savings_month_summary' ? { updated_at: new Date().toISOString() } : {})); return hit }
    if (sort) hit.sort((a, b) => (String(a[sort!.col]) < String(b[sort!.col]) ? -1 : 1) * (sort!.asc ? 1 : -1))
    return (range ? hit.slice(range[0], range[1] + 1) : hit).slice(0, limit)
  }
  const q: Record<string, unknown> = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === 'insert' || prop === 'update') return (p: Row) => { op = prop; payload = p; return q }
      if (prop === 'eq') return (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q }
      if (prop === 'gte') return (c: string, v: string) => { filters.push((r) => String(r[c]) >= v); return q }
      if (prop === 'gt') return (c: string, v: string) => { filters.push((r) => String(r[c]) > v); return q }
      if (prop === 'lt') return (c: string, v: string) => { filters.push((r) => String(r[c]) < v); return q }
      if (prop === 'is') return (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return q }
      if (prop === 'or') return (expr: string) => { if (expr.startsWith('source.is.null')) filters.push((r) => (r.source ?? null) !== 'carry'); return q }
      if (prop === 'order') return (c: string, o?: { ascending?: boolean }) => { if (c !== 'id') sort = { col: c, asc: o?.ascending !== false }; return q }
      if (prop === 'range') return (a: number, b: number) => { range = [a, b]; return q }
      if (prop === 'limit') return (n: number) => { limit = n; return q }
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: run()[0] ?? null, error: null })
      if (prop === 'then') return (res: (v: unknown) => unknown) => { const data = run(); return Promise.resolve({ data, count: data.length, error: null }).then(res) }
      return () => q
    },
  })
  return q
}

import { GET as cron } from './month-carry/route'
import { GET as carryGet, POST as carryPost } from '@/app/api/savings/carry/route'

const cronReq = (qs = '') => new Request(`http://x/api/cron/month-carry${qs}`, { headers: { authorization: 'Bearer s3cret' } })
const post = (monthKey: string) => carryPost(new Request('http://x/api/savings/carry', { method: 'POST', body: JSON.stringify({ monthKey }) }))
const summary = (monthKey: string) => h.db.savings_month_summary!.find((r) => r.month_key === monthKey)!
const summaryRow = (o: Row) => ({ user_id: 'u1', target: 0, allocated: 0, saved: 0, currency: 'EGP', pocket_id: 'p1', carry_adjustment: 0, carry_settled_at: null, closed_at: '2026-10-01', updated_at: '2026-10-01', ...o })

describe('month carry drift', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'))
    h.rpcs = []; h.userId = 'u1'; h.failRpc = false
    h.figs = { '2026-09': { income: 1500, spend: 0, allocated: 0 }, '2026-10': { income: 3000, spend: 0, allocated: 0 } }
    h.db = {
      user_settings: [{ user_id: 'u1', month_start_day: 1, language: 'en', goal_progress_alerts: true, timezone: 'Africa/Cairo' }],
      profiles: [{ id: 'u1', created_at: '2020-01-01T00:00:00Z', base_currency: 'EGP', default_carry_pocket_id: null }],
      savings_accounts: [{ id: 'p1', user_id: 'u1', name: 'Vault', category: 'savings', type: 'vault', currency: 'EGP', current_balance: 5000, held_in_payment_method_id: 'acct1', created_at: '2026-01-01' }],
      savings_month_summary: [summaryRow({ month_key: '2026-09', carry: 1000 })],
      goals: [], expenses: [{ id: 'late', user_id: 'u1', expense_date: '2026-09-10', updated_at: '2026-10-20' }], income_events: [], income_sources: [], savings_transactions: [], payment_methods: [{ id: 'acct1', user_id: 'u1', opening_balance: 0 }],
    }
    process.env.CRON_SECRET = 's3cret'
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ rates: { EGP: 50, USD: 1 } }) }))
  })

  it('the next close nets a positive prior delta into the new carry and settles the old month', async () => {
    await cron(cronReq())
    expect(summary('2026-10')).toMatchObject({ carry: 3500, carry_adjustment: -500 })
    expect(summary('2026-09')).toMatchObject({ carry: 1000, carry_adjustment: 500 })
    expect(h.rpcs).toHaveLength(1)
    expect(h.rpcs[0]).toMatchObject({ p_delta: 3500 })
    const [oct, sep] = [summary('2026-10'), summary('2026-09')]
    expect(Number(oct.carry) + Number(oct.carry_adjustment)).toBe(h.figs['2026-10']!.income)
    expect(Number(sep.carry) + Number(sep.carry_adjustment)).toBe(h.figs['2026-09']!.income)
  })

  it('the next close nets a negative prior delta into the new carry', async () => {
    h.figs['2026-09'] = { income: 400, spend: 0, allocated: 0 }
    await cron(cronReq())
    expect(summary('2026-10')).toMatchObject({ carry: 2400, carry_adjustment: 600 })
    expect(summary('2026-09')).toMatchObject({ carry_adjustment: -600 })
  })

  it('a prior shortfall bigger than the new carry nets nothing: the claim is released and the month stays stale', async () => {
    h.figs['2026-09'] = { income: 400, spend: 0, allocated: 0 }
    h.figs['2026-10'] = { income: 100, spend: 0, allocated: 0 }
    await cron(cronReq())
    expect(summary('2026-10')).toMatchObject({ carry: 100, carry_adjustment: 0 })
    expect(summary('2026-09')).toMatchObject({ carry_adjustment: 0, carry_settled_at: null })
    const { cycles } = await (await carryGet(new Request('http://x/api/savings/carry'))).json()
    expect(cycles.find((c: { monthKey: string }) => c.monthKey === '2026-09')).toMatchObject({ stale: true, delta: -600 })
  })

  it('rerunning the cron for already closed cycles changes nothing', async () => {
    await cron(cronReq())
    const snapshot = JSON.stringify(h.db.savings_month_summary)
    const rpcs = h.rpcs.length
    await cron(cronReq())
    expect(JSON.stringify(h.db.savings_month_summary)).toBe(snapshot)
    expect(h.rpcs).toHaveLength(rpcs)
  })

  it('a figure that moved with no row written since the close (a rate move) is not netted into the next close', async () => {
    h.db.expenses = []
    await cron(cronReq())
    expect(summary('2026-10')).toMatchObject({ carry: 3000, carry_adjustment: 0 })
    expect(summary('2026-09')).toMatchObject({ carry: 1000, carry_adjustment: 0 })
  })

  it('a dry run writes nothing', async () => {
    const snapshot = JSON.stringify(h.db)
    const body = await (await cron(cronReq('?dryRun=1'))).json()
    expect(body).toMatchObject({ dryRun: true, carried: 0 })
    expect(JSON.stringify(h.db)).toBe(snapshot)
    expect(h.rpcs).toEqual([])
  })

  describe('/api/savings/carry', () => {
    beforeEach(() => {
      h.db.savings_month_summary = [summaryRow({ month_key: '2026-09', carry: 1000 }), summaryRow({ month_key: '2026-10', carry: 3000 })]
    })

    it('GET lists the drift of closed months and writes nothing', async () => {
      const snapshot = JSON.stringify(h.db)
      const { cycles } = await (await carryGet(new Request('http://x/api/savings/carry'))).json()
      expect(cycles).toEqual([
        { monthKey: '2026-10', posted: 3000, recomputed: 3000, delta: 0, stale: false, currency: 'EGP' },
        { monthKey: '2026-09', posted: 1000, recomputed: 1500, delta: 500, stale: true, currency: 'EGP' },
      ])
      expect(JSON.stringify(h.db)).toBe(snapshot)
    })

    it('rejects an unauthenticated caller', async () => {
      h.userId = null
      expect((await carryGet(new Request('http://x/api/savings/carry'))).status).toBe(401)
    })

    it('POST deposits a rise once, leaves carry and closed_at alone, and a second tap is a no-op', async () => {
      const first = await (await post('2026-09')).json()
      expect(first.cycle).toMatchObject({ posted: 1500, delta: 0, stale: false })
      expect(h.rpcs).toHaveLength(1)
      expect(h.rpcs[0]).toMatchObject({ p_pocket: 'p1', p_delta: 500, p_kind: 'deposit', p_source: 'carry', p_note: 'Carry adjustment · 2026-09', p_date: '2026-09-30' })
      expect(summary('2026-09')).toMatchObject({ carry: 1000, carry_adjustment: 500, closed_at: '2026-10-01' })
      await post('2026-09')
      expect(h.rpcs).toHaveLength(1)
      expect(h.db.savings_accounts![0]!.current_balance).toBe(5500)
    })

    it('POST withdraws a fall, capped at what the pocket holds, and reports the rest as unapplied', async () => {
      h.figs['2026-09'] = { income: 200, spend: 0, allocated: 0 }
      ;(h.db.savings_accounts![0] as Row).current_balance = 300
      const body = await (await post('2026-09')).json()
      expect(h.rpcs[0]).toMatchObject({ p_delta: -300, p_kind: 'withdrawal', p_source: 'carry' })
      expect(body.unapplied).toBe(500)
      expect(summary('2026-09')).toMatchObject({ carry: 1000, carry_adjustment: -300 })
    })

    it('a moved figure with no later row is not stale, and a settled month stays quiet while old rows predate the settle', async () => {
      h.db.expenses = []
      const cycles = (await (await carryGet(new Request('http://x/api/savings/carry'))).json()).cycles
      expect(cycles.find((c: { monthKey: string }) => c.monthKey === '2026-09')).toMatchObject({ delta: 500, stale: false })
      h.db.expenses = [{ id: 'late', user_id: 'u1', expense_date: '2026-09-10', updated_at: '2026-10-20' }]
      h.figs['2026-09'] = { income: 200, spend: 0, allocated: 0 }
      ;(h.db.savings_accounts![0] as Row).current_balance = 300
      await post('2026-09')
      const after = (await (await carryGet(new Request('http://x/api/savings/carry'))).json()).cycles
      expect(after.find((c: { monthKey: string }) => c.monthKey === '2026-09')).toMatchObject({ delta: -500, stale: false })
    })

    it('POST on a month that is no longer stale books nothing', async () => {
      await post('2026-10')
      expect(h.rpcs).toEqual([])
    })

    it('a tap and the cron racing on one stale month apply it exactly once', async () => {
      h.db.savings_month_summary = [summaryRow({ month_key: '2026-09', carry: 1000 })]
      await Promise.all([post('2026-09'), cron(cronReq())])
      const viaTap = h.rpcs.filter((r) => r.p_note === 'Carry adjustment · 2026-09').length
      const viaCron = summary('2026-10')?.carry === 3500 ? 1 : 0
      expect(summary('2026-09')).toMatchObject({ carry_adjustment: 500 })
      expect(viaTap + viaCron).toBe(1)
    })

    it('a released claim leaves the month stale even though the trigger moved updated_at', async () => {
      h.failRpc = true
      await post('2026-09')
      expect(summary('2026-09').updated_at).not.toBe('2026-10-01')
      const { cycles } = await (await carryGet(new Request('http://x/api/savings/carry'))).json()
      expect(cycles.find((c: { monthKey: string }) => c.monthKey === '2026-09')).toMatchObject({ stale: true, delta: 500 })
    })

    it('a settled month stamps carry_settled_at', async () => {
      await post('2026-09')
      expect(summary('2026-09').carry_settled_at).toBe('2026-11-14T10:00:00.000Z')
    })

    it('two taps apply once', async () => {
      await Promise.all([post('2026-09'), post('2026-09')])
      expect(h.rpcs).toHaveLength(1)
      expect(summary('2026-09')).toMatchObject({ carry_adjustment: 500 })
    })

    it('a failed post gives the claim back and the month stays stale', async () => {
      h.failRpc = true
      expect((await post('2026-09')).status).toBe(500)
      expect(summary('2026-09')).toMatchObject({ carry_adjustment: 0, carry_settled_at: null })
      h.failRpc = false
      await post('2026-09')
      expect(h.rpcs).toHaveLength(1)
    })

    it('a figure returning to an earlier value still moves money (the ledger key is per application)', async () => {
      h.db.savings_month_summary = [summaryRow({ month_key: '2026-09', carry: 1000 })]
      for (const [income, day] of [[1500, 15], [1000, 16], [1500, 17]] as const) {
        vi.setSystemTime(new Date(`2026-11-${day}T10:00:00Z`))
        h.figs['2026-09'] = { income, spend: 0, allocated: 0 }
        h.db.expenses = [{ id: 'late', user_id: 'u1', expense_date: '2026-09-10', updated_at: `2026-12-${day}` }]
        await post('2026-09')
      }
      expect(h.rpcs.map((r) => r.p_delta)).toEqual([500, -500, 500])
      expect(summary('2026-09')).toMatchObject({ carry_adjustment: 500 })
    })

    it('a pocket that no longer exists takes nothing and leaves the month stale', async () => {
      ;(summary('2026-09') as Row).pocket_id = 'gone'
      const body = await (await post('2026-09')).json()
      expect(h.rpcs).toEqual([])
      expect(body).toMatchObject({ unapplied: 500, outcome: 'unapplied' })
      expect(summary('2026-09')).toMatchObject({ carry_adjustment: 0, carry_settled_at: null })
    })

    it('a pocket in a currency with no price takes nothing', async () => {
      ;(h.db.savings_accounts![0] as Row).currency = 'XAU'
      const body = await (await post('2026-09')).json()
      expect(h.rpcs).toEqual([])
      expect(body.outcome).toBe('unapplied')
      expect(summary('2026-09')).toMatchObject({ carry_adjustment: 0 })
    })

    it('a savings deposit written after the settle makes the month stale; a carry posting does not', async () => {
      h.db.expenses = []
      h.db.savings_transactions = [{ user_id: 'u1', transaction_date: '2026-09-10', source: 'carry', updated_at: '2026-10-20' }]
      const stale = async () => (await (await carryGet(new Request('http://x/api/savings/carry'))).json()).cycles.find((c: { monthKey: string }) => c.monthKey === '2026-09').stale
      expect(await stale()).toBe(false)
      h.db.savings_transactions = [{ user_id: 'u1', transaction_date: '2026-09-10', source: null, updated_at: '2026-10-20' }]
      expect(await stale()).toBe(true)
    })

    it('POST with no pocket records the adjustment on the summary row only', async () => {
      ;(summary('2026-09') as Row).pocket_id = null
      await post('2026-09')
      expect(h.rpcs).toEqual([])
      expect(summary('2026-09')).toMatchObject({ carry: 1000, carry_adjustment: 500 })
    })
  })
})
