import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Write { table: string; op: string; row: Record<string, unknown>; chainedSelect: boolean }
const h = vi.hoisted(() => ({
  writes: [] as { table: string; op: string; row: Record<string, unknown> }[],
  rpcs: [] as string[],
  tables: {} as Record<string, Record<string, unknown>[]>,
  latestSummary: null as { month_key: string } | null,
  deposits: [] as Record<string, unknown>[],
  figures: null as null | ((call: number) => { income: number; spend: number; allocated: number } | null),
  figuresCalls: 0,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: fake, rpc: (name: string) => { h.rpcs.push(name); return Promise.resolve({ data: null, error: null }) } }) }))
vi.mock('@/lib/server/pocketLedger', () => ({
  primaryTrackedAccountId: async () => 'acct',
  depositToPocket: async (_s: unknown, args: Record<string, unknown>) => { h.deposits.push(args) },
}))
vi.mock('@/lib/server/allocateGoalFunding', () => ({ allocateGoalFunding: async ({ carry }: { carry: number }) => carry }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: async () => undefined }))
vi.mock('@/lib/savings/cycleCarryFigures', async (orig) => {
  const actual = await orig<typeof import('@/lib/savings/cycleCarryFigures')>()
  return { cycleCarryFigures: (i: Parameters<typeof actual.cycleCarryFigures>[0]) => (h.figures ? h.figures(h.figuresCalls++) : actual.cycleCarryFigures(i)) }
})

/** A PostgREST stand-in: reads answer from `h.tables` (default empty, one user) and every write is recorded. */
function fake(table: string) {
  let wrote: Write | null = null
  const q: unknown = new Proxy({}, {
    get: (_t, prop: string) => {
      if (['insert', 'update', 'upsert', 'delete'].includes(prop)) {
        return (row: Record<string, unknown>) => { wrote = { table, op: prop, row, chainedSelect: false }; h.writes.push(wrote); return q }
      }
      if (prop === 'single') return () => Promise.resolve({ data: { id: `new-${table}-${h.writes.length}` }, error: null })
      if (prop === 'maybeSingle') {
        return () => Promise.resolve({
          data: table === 'profiles' ? (h.tables.profiles?.[0] ?? { created_at: '2020-01-01T00:00:00Z', base_currency: 'EGP', default_carry_pocket_id: null })
            : table === 'savings_month_summary' ? h.latestSummary : null,
          error: null,
        })
      }
      if (prop === 'then') {
        const rows = h.tables[table] ?? (table === 'user_settings' ? [{ user_id: 'u1', month_start_day: 1, language: 'en', goal_progress_alerts: true, timezone: 'Africa/Cairo' }] : [])
        return (res: (v: unknown) => unknown) => Promise.resolve({ data: wrote ? null : rows, error: null }).then(res)
      }
      return () => q
    },
  })
  return q
}

import { GET } from './month-carry/route'

const req = (qs = '') => new Request(`http://x/api/cron/month-carry${qs}`, { headers: { authorization: 'Bearer s3cret' } })
const writesTo = (table: string, op?: string) => h.writes.filter((w) => w.table === table && (!op || w.op === op))

describe('month-carry dry run', () => {
  beforeEach(() => {
    h.writes = []; h.rpcs = []; h.tables = {}; h.latestSummary = null; h.deposits = []; h.figures = null; h.figuresCalls = 0
    process.env.CRON_SECRET = 's3cret'
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ rates: { EGP: 50, USD: 1 } }) }))
  })

  it('reads and reports counts, and writes nothing', async () => {
    const res = await GET(req('?dryRun=1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, dryRun: true, scanned: 1, carried: 0, failed: 0 })
    expect(JSON.stringify(body)).not.toContain('u1')
    expect(h.writes).toEqual([])
    expect(h.rpcs).toEqual([])
  })

  it('still refuses without the secret, dry run or not', async () => {
    expect((await GET(new Request('http://x/api/cron/month-carry?dryRun=1'))).status).toBe(401)
  })
})

describe('month-carry live run', () => {
  const goalRow = (o: Record<string, unknown>) => ({ id: 'g1', name: 'Car', category: 'purchase', status: 'active', priority: 1, funding_mode: 'manual', linked_savings_account_ids: [], created_at: '2026-01-01', ...o })
  const pocketRow = (o: Record<string, unknown>) => ({ id: 'p1', name: 'p', category: 'savings', type: 'bank', currency: 'EGP', current_balance: 0, created_at: '2026-01-01', ...o })

  beforeEach(() => {
    h.writes = []; h.rpcs = []; h.tables = {}; h.deposits = []; h.figuresCalls = 0
    h.figures = () => ({ income: 1000, spend: 0, allocated: 0 })
    h.latestSummary = { month_key: '2000-01' }
    process.env.CRON_SECRET = 's3cret'
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ rates: { EGP: 50, USD: 1 } }) }))
  })

  it('RPW-1: unassigned carry never lands in a funded goal\'s auto-created pocket', async () => {
    h.tables.savings_accounts = [pocketRow({ id: 'gp', name: 'Car pocket', type: 'vault' })]
    h.tables.goals = [goalRow({ funding_mode: 'share', linked_savings_account_ids: ['gp'] })]
    await GET(req())
    expect(h.deposits.length).toBeGreaterThan(0)
    expect(h.deposits.every((d) => d.pocketId !== 'gp')).toBe(true)
    expect(writesTo('savings_accounts', 'insert')[0]?.row.name).toBe('Monthly Savings')
  })

  it('RPW-2: a null-figures cycle writes an empty summary and the newer cycles still run', async () => {
    h.figures = (call) => (call === 0 ? null : { income: 1000, spend: 0, allocated: 0 })
    const body = await (await GET(req())).json()
    const keys = writesTo('savings_month_summary', 'insert').map((w) => w.row.month_key as string)
    expect(keys.length).toBe(3)
    expect(new Set(keys).size).toBe(3)
    expect(keys).toEqual([...keys].sort())
    const skipped = writesTo('savings_month_summary', 'insert')[0]!.row
    expect(skipped).toMatchObject({ carry: 0, saved: 0, allocated: 0 })
    expect(body.carried).toBe(2)
    expect(h.deposits.length).toBe(2)
  })

  it('RPW-2: a goal linked only to a gold pocket does not get the carry', async () => {
    h.tables.savings_accounts = [pocketRow({ id: 'gold1', type: 'gold', currency: 'XAU' })]
    h.tables.goals = [goalRow({ linked_savings_account_ids: ['gold1'] })]
    await GET(req())
    expect(h.deposits.every((d) => d.pocketId !== 'gold1')).toBe(true)
  })

  it('SLG-1: a manual goal with no eligible pocket gets one pocket, linked to the goal', async () => {
    h.tables.goals = [goalRow({})]
    await GET(req())
    const created = writesTo('savings_accounts', 'insert')
    expect(created.length).toBeGreaterThan(0)
    expect(created[0]!.row.name).toBe('Car')
    const links = writesTo('goals', 'update')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]!.row.linked_savings_account_ids).toHaveLength(1)
  })

  it('SLG-1: an unlinked pocket left by a crashed run is linked, not duplicated', async () => {
    h.tables.goals = [goalRow({})]
    h.tables.savings_accounts = [pocketRow({ id: 'orphan', name: 'Car', type: 'vault' })]
    await GET(req())
    expect(writesTo('savings_accounts', 'insert')).toEqual([])
    expect(writesTo('goals', 'update')[0]!.row.linked_savings_account_ids).toEqual(['orphan'])
    expect(h.deposits.every((d) => d.pocketId === 'orphan')).toBe(true)
  })

  it('SLG-1: a goal that already owns an eligible pocket is not given another', async () => {
    h.tables.goals = [goalRow({ linked_savings_account_ids: ['p1'] })]
    h.tables.savings_accounts = [pocketRow({ id: 'p1' })]
    await GET(req())
    expect(writesTo('savings_accounts', 'insert')).toEqual([])
    expect(writesTo('goals', 'update')).toEqual([])
  })
})
