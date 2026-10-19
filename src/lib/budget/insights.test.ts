import { describe, expect, it } from 'vitest'
import { computeInsights, type InsightsInput } from './insights'

const zero = { bills: 0, subscriptions: 0, debts: 0, everyday: 0, safety: 0, goals: 0, grow: 0 }
const calm: InsightsInput = {
  income: 10000, totals: zero, essentialsMonthly: 4000, liquidSavings: 24000, emergencyTargetMonths: 3,
  housingMonthly: 3000, lines: [], subscriptionsLive: 200, subscriptionsPlanned: 200,
  unassignedSpend: 0, free: 0,
}
const run = (o: Partial<InsightsInput>) => computeInsights({ ...calm, ...o })
const kinds = (o: Partial<InsightsInput>) => run(o).map((i) => i.kind)

describe('insight rules', () => {
  it('is silent when everything is fine', () => {
    expect(run({})).toEqual([])
  })

  it('safety net under target, with months to target', () => {
    const [i] = run({ liquidSavings: 8000, totals: { ...zero, safety: 1000 } })
    expect(i).toMatchObject({
      kind: 'safetyNet', severity: 'warn', mood: 'worried',
      params: { runway: 2, target: 3, monthsToTarget: 4 },
    })
  })
  it('safety net with no contribution never arrives', () => {
    expect(run({ liquidSavings: 8000 })[0].params.monthsToTarget).toBe(-1)
  })
  it('safety net skipped without essentials', () => {
    expect(kinds({ essentialsMonthly: 0, liquidSavings: 0 })).toEqual([])
  })

  it('line over cap three months in a row suggests raising to avg3', () => {
    const [i] = run({ lines: [{ id: 'l1', name: 'Dining', block: 'everyday', planned: 500, monthsOverCap: 3, avg3: 650 }] })
    expect(i).toMatchObject({ kind: 'lineOverCap', lineId: 'l1', action: 'raise', severity: 'warn', params: { avg3: 650 } })
  })
  it('suggests capping when avg3 is not above the cap, ignores shorter streaks', () => {
    const lines = [{ id: 'l1', name: 'Dining', block: 'everyday' as const, planned: 500, monthsOverCap: 3, avg3: null }]
    expect(run({ lines })[0].action).toBe('cap')
    expect(run({ lines: [{ ...lines[0], monthsOverCap: 2 }] })).toEqual([])
    const fixed = run({ lines: [{ id: 'l1', name: 'Dining', block: 'everyday', planned: 500, monthsOverCap: 3, avg3: 650, fixed: true }] })
    expect(fixed[0].action).toBe('openLine')
  })

  it('housing share above 35%', () => {
    expect(run({ housingMonthly: 3500 })).toEqual([])
    expect(run({ housingMonthly: 3600 })[0]).toMatchObject({ kind: 'housingShare', severity: 'warn', params: { percent: 36 } })
  })
  it('essentials share above 60% is info', () => {
    expect(run({ essentialsMonthly: 6500 }).find((i) => i.kind === 'essentialsShare')).toMatchObject({ severity: 'info', mood: 'curious' })
  })
  it('subscription drift beyond 5 in either direction', () => {
    expect(run({ subscriptionsLive: 205 })).toEqual([])
    expect(run({ subscriptionsLive: 230 })[0]).toMatchObject({ kind: 'subscriptionsDrift', params: { delta: 30 } })
    expect(run({ subscriptionsLive: 150 })[0].params.delta).toBe(-50)
  })
  it('unassigned spend', () => {
    expect(run({ unassignedSpend: 120 })[0]).toMatchObject({ kind: 'unassignedSpend', action: 'addLine', params: { amount: 120 } })
  })
  it('free money only above 1% of income', () => {
    expect(run({ free: 100 })).toEqual([])
    expect(run({ free: 101 })[0]).toMatchObject({ kind: 'freeToAssign', mood: 'happy', severity: 'info' })
  })
})

describe('composition', () => {
  const noisy: Partial<InsightsInput> = {
    liquidSavings: 8000,
    housingMonthly: 4000,
    essentialsMonthly: 6500,
    subscriptionsLive: 400,
    unassignedSpend: 90,
    free: 500,
    lines: [{ id: 'l1', name: 'Dining', block: 'everyday', planned: 500, monthsOverCap: 4, avg3: 560 }],
  }
  it('returns at most three', () => {
    expect(run(noisy)).toHaveLength(3)
  })
  it('warnings come first, then by money at stake', () => {
    const out = run(noisy)
    expect(out.every((i) => i.severity === 'warn')).toBe(true)
    // safety gap (6500*3-8000=11500) > housing excess (500) > dining raise (60)
    expect(out.map((i) => i.kind)).toEqual(['safetyNet', 'housingShare', 'lineOverCap'])
  })
  it('info only fills the remaining slots, biggest first', () => {
    const out = run({ housingMonthly: 4000, essentialsMonthly: 6500, subscriptionsLive: 400, unassignedSpend: 90, free: 0 })
    expect(out.map((i) => i.kind)).toEqual(['housingShare', 'essentialsShare', 'subscriptionsDrift'])
  })
  it('does not leak the internal impact field', () => {
    expect(Object.keys(run({ free: 500 })[0])).not.toContain('impact')
  })
})
