import { describe, expect, it } from 'vitest'
import { nextReminderAt, REMINDER_GAP_MS, reminderDue, reminderObsolete } from './reminder'

const day = (h: number, m = 0) => new Date(2026, 10, 24, h, m)

describe('when the evening reminder is due', () => {
  it('is the same evening when it is at least two hours away', () => {
    expect(nextReminderAt(day(9))).toEqual(day(19))
    expect(nextReminderAt(day(16, 59))).toEqual(day(19))
  })

  it('is tomorrow evening once 7 pm is under two hours away or past', () => {
    expect(nextReminderAt(day(17, 1))).toEqual(new Date(2026, 10, 25, 19))
    expect(nextReminderAt(day(22))).toEqual(new Date(2026, 10, 25, 19))
  })

  it('rolls over a month end', () => {
    expect(nextReminderAt(new Date(2026, 10, 30, 21))).toEqual(new Date(2026, 11, 1, 19))
  })
})

describe('whether a reminder is scheduled', () => {
  const now = Date.UTC(2026, 10, 24, 10)

  it('only for findings the member has not seen', () => {
    expect(reminderDue({ sig: 'pace|topCategory', seen: 'kept|pace', remindedAt: null, now })).toBe(true)
    expect(reminderDue({ sig: 'pace|topCategory', seen: null, remindedAt: null, now })).toBe(true)
    expect(reminderDue({ sig: 'pace|topCategory', seen: 'pace|topCategory', remindedAt: null, now })).toBe(false)
  })

  it('never before the ledger is ready', () => {
    expect(reminderDue({ sig: '', seen: null, remindedAt: null, now })).toBe(false)
  })

  it('at most one a week', () => {
    expect(reminderDue({ sig: 'a', seen: null, remindedAt: now - REMINDER_GAP_MS + 1, now })).toBe(false)
    expect(reminderDue({ sig: 'a', seen: null, remindedAt: now - REMINDER_GAP_MS, now })).toBe(true)
  })
})

describe('when a pending reminder is cancelled', () => {
  it('once the member has seen what leads the page', () => {
    expect(reminderObsolete('a|b', 'a|b')).toBe(true)
  })

  it('not while the findings are still unseen, and not while the ledger is still loading', () => {
    expect(reminderObsolete('a|b', 'x|y')).toBe(false)
    expect(reminderObsolete('a|b', null)).toBe(false)
    expect(reminderObsolete('', null)).toBe(false)
    expect(reminderObsolete('', '')).toBe(false)
  })
})
