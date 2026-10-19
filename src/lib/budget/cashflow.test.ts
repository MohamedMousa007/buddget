import { describe, expect, it } from 'vitest'
import { buildCycleTimeline, type CycleLine, type CycleTimelineInput } from './cashflow'

const line = (o: Partial<CycleLine>): CycleLine => ({
  name: 'x', block: 'bills', amount: 0, dueDay: null, essential: true, auto: false, ...o,
})
const make = (o: Partial<CycleTimelineInput>): CycleTimelineInput => ({
  cycleStart: new Date(2026, 9, 25), cycleDays: 31, paydayDay: 25, income: 10000, openingCash: 0,
  lines: [], everydayMonthly: 0, ...o,
})
const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-')

describe('buildCycleTimeline', () => {
  it('payday income comes first and seeds cashAfter', () => {
    const t = buildCycleTimeline(make({ openingCash: 500 }))
    expect(t.events).toHaveLength(1)
    expect(t.events[0]).toMatchObject({ block: 'income', kind: 'income', amount: 10000, cashAfter: 10500 })
  })

  it('auto lines land on payday after income, with the right kinds', () => {
    const t = buildCycleTimeline(make({
      lines: [
        line({ name: 'Emergency', block: 'safety', amount: 1000, auto: true }),
        line({ name: 'Trip', block: 'goals', amount: 500, auto: true, dueDay: 3 }),
      ],
    }))
    expect(t.events.map((e) => [e.label, e.kind, ymd(e.date)])).toEqual([
      ['income', 'income', '2026-10-25'],
      ['Emergency', 'transfer', '2026-10-25'],
      ['Trip', 'transfer', '2026-10-25'],
    ])
    expect(t.events.map((e) => e.cashAfter)).toEqual([10000, 9000, 8500])
  })

  it('a dueDay before the payday day falls in the next calendar month', () => {
    const t = buildCycleTimeline(make({
      lines: [line({ name: 'Rent', amount: 3000, dueDay: 1 }), line({ name: 'Phone', amount: 200, dueDay: 28 })],
    }))
    const rent = t.events.find((e) => e.label === 'Rent')!
    const phone = t.events.find((e) => e.label === 'Phone')!
    expect(ymd(rent.date)).toBe('2026-11-1')
    expect(ymd(phone.date)).toBe('2026-10-28')
    expect(t.events.map((e) => e.label)).toEqual(['income', 'Phone', 'Rent'])
  })

  it('a dueDay equal to the payday day is on payday; 31 clamps to month length', () => {
    const t = buildCycleTimeline(make({
      lines: [line({ name: 'Gym', amount: 100, dueDay: 25 }), line({ name: 'Ins', amount: 100, dueDay: 31 })],
    }))
    expect(ymd(t.events.find((e) => e.label === 'Gym')!.date)).toBe('2026-10-25')
    expect(ymd(t.events.find((e) => e.label === 'Ins')!.date)).toBe('2026-10-31')
    const feb = buildCycleTimeline(make({
      cycleStart: new Date(2027, 0, 25), cycleDays: 31, paydayDay: 25,
      lines: [line({ name: 'Ins', amount: 100, dueDay: 30 })],
    }))
    expect(ymd(feb.events[1].date)).toBe('2027-1-30')
  })

  it('unscheduled bills, debts and subscriptions fall on the 1st inside the cycle', () => {
    const t = buildCycleTimeline(make({
      lines: [
        line({ name: 'Loan', block: 'debts', amount: 400 }),
        line({ name: 'Netflix', block: 'subscriptions', amount: 50 }),
        line({ name: 'Cushion', block: 'grow', amount: 300 }),
      ],
    }))
    const byLabel = Object.fromEntries(t.events.map((e) => [e.label, e]))
    expect(ymd(byLabel.Loan.date)).toBe('2026-11-1')
    expect(byLabel.Loan.kind).toBe('debt')
    expect(byLabel.Netflix.kind).toBe('subscription')
    expect(ymd(byLabel.Cushion.date)).toBe('2026-10-25')
  })

  it('everyday lines are covered by the daily allowance, not scheduled', () => {
    const t = buildCycleTimeline(make({ lines: [line({ block: 'everyday', amount: 900 })], everydayMonthly: 930 }))
    expect(t.events).toHaveLength(1)
    expect(t.dailyAllowance).toBe(30)
  })

  it('drifts cash down evenly and finds the lowest point', () => {
    const t = buildCycleTimeline(make({
      cycleDays: 30, income: 4000, everydayMonthly: 3000,
      lines: [line({ name: 'Rent', amount: 1000, dueDay: 1 })],
    }))
    expect(t.points).toHaveLength(30)
    expect(t.points[0].cash).toBe(3900)
    expect(t.points[1].cash).toBe(3800)
    const rentDay = t.points.findIndex((p) => ymd(p.date) === '2026-11-1')
    expect(t.points[rentDay].cash).toBe(4000 - 1000 - 100 * (rentDay + 1))
    expect(t.lowest).toEqual(t.points[29])
    expect(t.lowest.cash).toBe(0)
    expect(t.dipsBelowZero).toBe(false)
    expect(t.tightestDayLabel).toBe('23 Nov')
  })

  it('cashAfter on an event reflects spending drifted to the day before', () => {
    const t = buildCycleTimeline(make({
      cycleDays: 30, income: 3000, everydayMonthly: 3000,
      lines: [line({ name: 'Phone', amount: 200, dueDay: 28 })],
    }))
    expect(t.events[1].cashAfter).toBe(3000 - 200 - 100 * 3)
  })

  it('detects a dip below zero between paydays even when the month balances', () => {
    const t = buildCycleTimeline(make({
      cycleDays: 30, income: 5000, openingCash: 0,
      lines: [line({ name: 'Rent', amount: 3000, dueDay: 25 }), line({ name: 'Visa', block: 'debts', amount: 2500, dueDay: 26 })],
    }))
    expect(t.lowest.cash).toBe(-500)
    expect(t.dipsBelowZero).toBe(true)
    expect(t.tightestDayLabel).toBe('26 Oct')
  })

  it('drops lines whose date falls past a short cycle', () => {
    const t = buildCycleTimeline(make({ cycleDays: 5, lines: [line({ name: 'Rent', amount: 3000, dueDay: 1 })] }))
    expect(t.events).toHaveLength(1)
  })
})
