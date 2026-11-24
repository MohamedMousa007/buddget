import { describe, expect, it } from 'vitest'
import { dailySnapshotDue, snapshotDay, snapshotStampKey } from './netWorthSnapshot'

const base = { ready: true, netWorth: 125000.5, lastDay: '2026-11-23', today: '2026-11-24' }

describe('the daily net worth snapshot rule', () => {
  it('writes once the figure is complete and today has no snapshot yet', () => {
    expect(dailySnapshotDue(base)).toBe(true)
    expect(dailySnapshotDue({ ...base, lastDay: null })).toBe(true)
  })

  it('never writes a figure that is not complete: a partial total would draw a false dip', () => {
    expect(dailySnapshotDue({ ...base, ready: false })).toBe(false)
  })

  it('never writes a figure that is not a number', () => {
    expect(dailySnapshotDue({ ...base, netWorth: Number.NaN })).toBe(false)
    expect(dailySnapshotDue({ ...base, netWorth: Number.POSITIVE_INFINITY })).toBe(false)
  })

  it('writes at most once a day: a second open the same day sends nothing', () => {
    expect(dailySnapshotDue({ ...base, lastDay: '2026-11-24' })).toBe(false)
  })

  it('a zero or negative net worth is a real figure and is saved', () => {
    expect(dailySnapshotDue({ ...base, netWorth: 0 })).toBe(true)
    expect(dailySnapshotDue({ ...base, netWorth: -8200 })).toBe(true)
  })
})

describe('snapshot keys', () => {
  it('the day is the local calendar day, zero padded', () => {
    expect(snapshotDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(snapshotDay(new Date(2026, 10, 24, 0, 1))).toBe('2026-11-24')
  })

  it('the stamp is per account and currency, so another sign-in or base currency starts clean', () => {
    expect(snapshotStampKey('u1', 'EGP')).not.toBe(snapshotStampKey('u2', 'EGP'))
    expect(snapshotStampKey('u1', 'EGP')).not.toBe(snapshotStampKey('u1', 'USD'))
  })
})
