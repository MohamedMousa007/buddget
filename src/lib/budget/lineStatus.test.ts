import { describe, expect, it } from 'vitest'
import { getLineStatus, type LineStatusInput } from './lineStatus'

const base: LineStatusInput = {
  block: 'everyday', planned: 1000, spent: 0, mode: 'month', dayOfCycle: 10, daysInCycle: 30,
  dueDay: null, paid: false, linkedDrift: 0, locked: false, essential: false,
  averageSpend: null, unbudgeted: false, hasHistoryOverCap: 0,
}
const get = (o: Partial<LineStatusInput>) => getLineStatus({ ...base, ...o })

describe('getLineStatus kinds', () => {
  it('ok', () => {
    expect(get({ spent: 100 })).toMatchObject({ kind: 'ok', tone: 'ok', button: { action: 'none' } })
  })
  it('near at 85% of the cap, not before', () => {
    expect(get({ spent: 849 }).kind).toBe('ok')
    const v = get({ spent: 850 })
    expect(v).toMatchObject({ kind: 'near', tone: 'warn', button: { action: 'review' }, params: { percent: 85 } })
  })
  it('exactly at the cap is near, above is over', () => {
    expect(get({ spent: 1000 }).kind).toBe('near')
    const v = get({ spent: 1200 })
    expect(v).toMatchObject({ kind: 'over', tone: 'bad', button: { action: 'raiseOrCap', variant: 'outline' }, params: { overBy: 200, percent: 120 } })
  })
  it('over escalates to destructive after three months running', () => {
    expect(get({ spent: 1200, hasHistoryOverCap: 3 }).button.variant).toBe('destructive')
    expect(get({ spent: 1200, hasHistoryOverCap: 3 }).params.months).toBe(3)
  })
  it('unbudgetedSpend', () => {
    const v = get({ planned: 0, spent: 80, unbudgeted: true, averageSpend: 60 })
    expect(v).toMatchObject({ kind: 'unbudgetedSpend', button: { action: 'addLine' }, params: { overBy: 80, average: 60 } })
  })
  it('drifted beyond 0.5 only', () => {
    expect(get({ linkedDrift: 0.5 }).kind).toBe('ok')
    expect(get({ linkedDrift: -12 })).toMatchObject({ kind: 'drifted', button: { action: 'update' }, params: { delta: -12 } })
  })
  it('dueSoon within 7 days and unpaid', () => {
    expect(get({ dueDay: 17 })).toMatchObject({ kind: 'dueSoon', button: { action: 'pay' }, params: { daysLeft: 7 } })
    expect(get({ dueDay: 18 }).kind).toBe('ok')
    expect(get({ dueDay: 8 })).toMatchObject({ kind: 'dueSoon', tone: 'bad', params: { daysLeft: -2 } })
    expect(get({ dueDay: 12, paid: true }).kind).toBe('paid')
  })
  it('unfunded for essential or linked blocks at zero', () => {
    expect(get({ planned: 0, essential: true }).kind).toBe('unfunded')
    expect(get({ planned: 0, block: 'safety' }).kind).toBe('unfunded')
    expect(get({ planned: 0 }).kind).toBe('ok')
  })
  it('paid and locked', () => {
    expect(get({ paid: true }).kind).toBe('paid')
    expect(get({ mode: 'plan', locked: true })).toMatchObject({ kind: 'locked', tone: 'mut', icon: 'lock' })
  })
})

describe('precedence', () => {
  it('over beats unbudgetedSpend, near, drifted, dueSoon, paid', () => {
    expect(get({ spent: 1500, linkedDrift: 9, dueDay: 12, paid: true }).kind).toBe('over')
  })
  it('unbudgetedSpend beats near and drifted', () => {
    expect(get({ unbudgeted: true, spent: 50, linkedDrift: 9 }).kind).toBe('unbudgetedSpend')
  })
  it('near beats drifted beats dueSoon beats unfunded beats paid', () => {
    expect(get({ spent: 900, linkedDrift: 9, dueDay: 12 }).kind).toBe('near')
    expect(get({ linkedDrift: 9, dueDay: 12 }).kind).toBe('drifted')
    expect(get({ planned: 0, essential: true, dueDay: 12 }).kind).toBe('dueSoon')
    expect(get({ planned: 0, essential: true, paid: true }).kind).toBe('unfunded')
  })
  it('paid beats locked in month mode', () => {
    expect(get({ paid: true, locked: true }).kind).toBe('paid')
  })
})

describe('plan mode', () => {
  const plan = (o: Partial<LineStatusInput>) => get({ mode: 'plan', ...o })
  it('ignores spend, due dates and paid', () => {
    expect(plan({ spent: 5000, unbudgeted: true, dueDay: 11, paid: true }).kind).toBe('ok')
  })
  it('keeps drifted, unfunded, locked, ok', () => {
    expect(plan({ linkedDrift: 20 }).kind).toBe('drifted')
    expect(plan({ planned: 0, essential: true }).kind).toBe('unfunded')
    expect(plan({ locked: true }).kind).toBe('locked')
    expect(plan({}).kind).toBe('ok')
  })
})

describe('paid bills', () => {
  it('read paid, not near, when the bill is fully spent and paid', () => {
    const v = getLineStatus({ ...base, block: 'bills', mode: 'month', planned: 4800, spent: 4800, paid: true, dueDay: 1, dayOfCycle: 19 })
    expect(v.kind).toBe('paid')
  })
})
