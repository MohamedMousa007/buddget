import { afterEach, describe, expect, it } from 'vitest'
import { advanceCycle, computeNextBillingDate, firstBillingOnOrAfter, upcomingBillingDate } from './subscriptionDates'

const next = (start: string, day: number, cycle: Parameters<typeof computeNextBillingDate>[2], ref: string) =>
  computeNextBillingDate(start, day, cycle, new Date(`${ref}T12:00:00`))

describe('computeNextBillingDate', () => {
  it('returns today when the charge is due today', () => {
    expect(next('2026-01-17', 17, 'monthly', '2026-10-17')).toBe('2026-10-17')
  })

  it('rolls to next month once the day has passed', () => {
    expect(next('2026-01-10', 10, 'monthly', '2026-10-17')).toBe('2026-11-10')
  })

  it('clamps the 31st into short months without drifting the billing day', () => {
    expect(next('2026-01-31', 31, 'monthly', '2026-02-01')).toBe('2026-02-28')
    // March must go back to the 31st, not stay on the clamped 28th.
    expect(next('2026-01-31', 31, 'monthly', '2026-03-01')).toBe('2026-03-31')
    expect(next('2026-01-31', 31, 'monthly', '2026-04-05')).toBe('2026-04-30')
  })

  it('uses Feb 29 in a leap year and Feb 28 otherwise', () => {
    expect(next('2024-01-30', 30, 'monthly', '2024-02-01')).toBe('2024-02-29')
    expect(next('2025-01-30', 30, 'monthly', '2025-02-01')).toBe('2025-02-28')
  })

  it('keeps a yearly Feb-29 subscription on the 29th in the next leap year', () => {
    expect(next('2024-02-29', 29, 'yearly', '2024-03-01')).toBe('2025-02-28')
    expect(next('2024-02-29', 29, 'yearly', '2027-03-01')).toBe('2028-02-29')
  })

  it('steps quarterly by three months, clamping each hop', () => {
    expect(next('2026-01-31', 31, 'quarterly', '2026-02-01')).toBe('2026-04-30')
    expect(next('2026-01-31', 31, 'quarterly', '2026-05-01')).toBe('2026-07-31')
  })

  it('steps weekly from the start date, ignoring billingDay', () => {
    expect(next('2026-10-01', 1, 'weekly', '2026-10-17')).toBe('2026-10-22')
    expect(next('2026-10-17', 99, 'weekly', '2026-10-17')).toBe('2026-10-17')
  })

  it('a start date in the future is its own first billing', () => {
    expect(next('2026-12-05', 5, 'monthly', '2026-10-17')).toBe('2026-12-05')
    expect(next('2026-12-05', 5, 'weekly', '2026-10-17')).toBe('2026-12-05')
  })

  it('first billing falls in the following month when the day precedes the start day', () => {
    expect(firstBillingOnOrAfter(new Date(2026, 0, 31), 15).getMonth()).toBe(1)
  })

  it('advanceCycle handles a year boundary', () => {
    const d = advanceCycle(new Date(2026, 11, 31), 31, 'monthly')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 31])
  })
})

describe('upcomingBillingDate', () => {
  const sub = { startDate: '2026-01-10', billingDay: 10, billingCycle: 'monthly' as const, nextBillingDate: '2026-02-10' }

  it('ignores a stale stored date that already passed', () => {
    expect(upcomingBillingDate(sub, new Date(2026, 9, 17))).toBe('2026-11-10')
  })

  it('is stable on the charge day itself', () => {
    expect(upcomingBillingDate(sub, new Date(2026, 9, 10))).toBe('2026-10-10')
  })

  it('falls back to the stored date when there is no schedule to derive from', () => {
    expect(upcomingBillingDate({ ...sub, startDate: '' }, new Date(2026, 9, 17))).toBe('2026-02-10')
  })
})

describe('timezone / DST', () => {
  const original = process.env.TZ
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it.each(['Africa/Cairo', 'America/New_York', 'Pacific/Auckland', 'Asia/Dubai'])(
    'weekly and monthly stay on calendar days across DST in %s',
    (tz) => {
      process.env.TZ = tz
      // Cairo reintroduced DST in 2023 (starts last Friday of April); NY starts 8 Mar 2026.
      expect(computeNextBillingDate('2026-04-17', 17, 'weekly', new Date(2026, 3, 25))).toBe('2026-05-01')
      expect(computeNextBillingDate('2026-03-01', 8, 'monthly', new Date(2026, 2, 8))).toBe('2026-03-08')
      expect(computeNextBillingDate('2026-03-01', 8, 'monthly', new Date(2026, 2, 9))).toBe('2026-04-08')
      expect(computeNextBillingDate('2026-09-30', 30, 'weekly', new Date(2026, 9, 29))).toBe('2026-11-04')
    }
  )
})
