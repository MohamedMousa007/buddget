import { describe, it, expect } from 'vitest'
import { matchSalary } from './matchSalary'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'

/**
 * The salary matcher reads two tables: `income_sources` (the templates) and
 * `income_events` (which paydays are already settled). This fakes just those two
 * chains — `.select().eq().eq().is()` and `.select().eq().eq().is().in()`.
 */
type SalaryRow = Record<string, unknown>

function fakeService(sources: SalaryRow[], filledOccurrences: string[] = []) {
  const chain = (result: unknown) => {
    const self: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in']) {
      self[m] = () => (m === 'is' || m === 'in' ? Object.assign(Promise.resolve(result), self) : self)
    }
    // `.is(...)` ends the sources query; `.in(...)` ends the events query. Both must also
    // stay chainable, hence the Promise/self merge above.
    self.is = () => Object.assign(Promise.resolve(result), self)
    self.in = () => Promise.resolve(result)
    return self
  }
  return {
    from(table: string) {
      return table === 'income_sources'
        ? chain({ data: sources })
        : chain({ data: filledOccurrences.map((d) => ({ occurrence_date: d })) })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

/** Bi-weekly on the 5th and 20th, EGP — the shape a Deel-style salary is declared with. */
const BIWEEKLY = {
  id: 'src-bi',
  amount: 70000,
  currency: 'EGP',
  recurring_frequency: 'biweekly',
  day_of_month: 5,
  payday_days: [5, 20],
  payday_drift_days: null,
  effective_start: '2026-01-01',
  effective_end: null,
}

/** Monthly on the 30th — the fixture that makes a month-crossing snap unambiguous. */
const MONTHLY_30 = { ...BIWEEKLY, id: 'src-mo30', recurring_frequency: 'monthly', payday_days: null, day_of_month: 30 }
/** Monthly on the 25th; 2026-07-25 is a Saturday, so the payday shifts back to Fri the 24th. */
const MONTHLY_25 = { ...BIWEEKLY, id: 'src-mo25', recurring_frequency: 'monthly', payday_days: null, day_of_month: 25 }
const WEEKLY = { ...BIWEEKLY, id: 'src-wk', recurring_frequency: 'weekly', payday_days: [4, 11, 18, 25], day_of_month: 4 }

const call = (sources: SalaryRow[], day: string, over: Partial<{ amount: number; currency: string }> = {}, filled: string[] = []) =>
  matchSalary(fakeService(sources, filled), {
    userId: 'u1',
    amount: over.amount ?? 70000,
    currency: over.currency ?? 'EGP',
    day,
    exchangeRates: DEFAULT_MARKET_RATES,
  })

describe('matchSalary — payday snapping', () => {
  it('stamps the exact payday when the paycheck lands on time', async () => {
    await expect(call([BIWEEKLY], '2026-07-20')).resolves.toEqual({
      outcome: 'matched',
      sourceId: 'src-bi',
      occurrenceDate: '2026-07-20',
    })
  })

  it('snaps a paycheck banked 3 days late back onto its own payday', async () => {
    // The Deel case: earned on the 20th, the wire clears on the 23rd. Without the stamp
    // buildOccurrences pairs positionally and this fills the WRONG payday.
    await expect(call([BIWEEKLY], '2026-07-23')).resolves.toEqual({
      outcome: 'matched',
      sourceId: 'src-bi',
      occurrenceDate: '2026-07-20',
    })
  })

  it('snaps backwards across a month boundary', async () => {
    // A 30 Jul payday banked on 2 Aug. August's own schedule does not contain 30 Jul, so a
    // "this month's paydays" search would never find it and the credit would land unlinked.
    await expect(call([MONTHLY_30], '2026-08-02')).resolves.toEqual({
      outcome: 'matched',
      sourceId: 'src-mo30',
      occurrenceDate: '2026-07-30',
    })
  })

  it('still links, but asks first, when no payday is within the window', async () => {
    // 8 days past the 20th and 8 short of Aug 5: outside ±7 either way. Never silently
    // dropped to an unlinked credit — the user gets the existing confirm push.
    await expect(call([BIWEEKLY], '2026-07-28')).resolves.toEqual({
      outcome: 'confirm',
      sourceId: 'src-bi',
      occurrenceDate: null,
    })
  })

  it('halves the window for weekly paydays so the nearest one is never a coin flip', async () => {
    // Weekly paydays sit 7 days apart, so a ±7 window would reach two of them at once and
    // "nearest" would be decided by a day. The cap is 3.
    // 15 Jul → the 18th is a Saturday, paid Fri the 17th, 2 days away.
    await expect(call([WEEKLY], '2026-07-15')).resolves.toMatchObject({ occurrenceDate: '2026-07-17' })
    // 28 Jul sits 4 days from the 24th and 7 from Aug 4 — a ±7 window would claim both.
    await expect(call([WEEKLY], '2026-07-28')).resolves.toEqual({
      outcome: 'confirm',
      sourceId: 'src-wk',
      occurrenceDate: null,
    })
  })

  it('leaves the credit unlinked when the payday it would fill is already settled', async () => {
    // A second paycheck-sized credit the day after that payday was settled is a bonus or a
    // correction — not the same paycheck arriving twice, and never an overwrite.
    await expect(call([BIWEEKLY], '2026-07-21', {}, ['2026-07-20'])).resolves.toEqual({ outcome: 'create' })
  })
})

describe('matchSalary — amount and currency', () => {
  it('asks rather than auto-links when the amount is off by more than 2%', async () => {
    const r = await call([BIWEEKLY], '2026-07-20', { amount: 75000 })
    expect(r).toEqual({ outcome: 'confirm', sourceId: 'src-bi', occurrenceDate: '2026-07-20' })
  })

  it('ignores a credit outside the confirm tolerance entirely', async () => {
    await expect(call([BIWEEKLY], '2026-07-20', { amount: 5000 })).resolves.toEqual({ outcome: 'create' })
  })

  it('reaches a cross-currency salary, but only ever as confirm', async () => {
    // 70,000 EGP ≈ 1,318 USD at the shipped rate. An FX move and a raise look identical
    // once converted, so this can never auto-link.
    const r = await call([BIWEEKLY], '2026-07-20', { amount: 1318, currency: 'USD' })
    expect(r).toEqual({ outcome: 'confirm', sourceId: 'src-bi', occurrenceDate: '2026-07-20' })
  })

  it('matches nothing when the source has ended', async () => {
    const ended = { ...BIWEEKLY, effective_end: '2026-06-30' }
    await expect(call([ended], '2026-07-20')).resolves.toEqual({ outcome: 'create' })
  })

  it('returns create when the user declared no salary', async () => {
    await expect(call([], '2026-07-20')).resolves.toEqual({ outcome: 'create' })
  })

  it('breaks an amount tie on which payday sits nearer the credit', async () => {
    // Both salaries are 70,000 EGP and both schedules reach 21 Jul: the monthly one pays the
    // 24th (3 days out), the bi-weekly one paid the 20th (1 day out). Listing the monthly
    // first proves array order is not what decides it.
    const r = await call([MONTHLY_25, BIWEEKLY], '2026-07-21')
    expect(r).toMatchObject({ sourceId: 'src-bi', occurrenceDate: '2026-07-20' })
  })

  it('falls back to a source with no nearby payday over none at all', async () => {
    // 30-of-the-month salary, credit on the 21st: no payday within ±7, but the amount is
    // exact — link it and ask, rather than losing the association entirely.
    await expect(call([MONTHLY_30], '2026-07-21')).resolves.toEqual({
      outcome: 'confirm',
      sourceId: 'src-mo30',
      occurrenceDate: null,
    })
  })
})
