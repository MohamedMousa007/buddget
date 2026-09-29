import { describe, it, expect } from 'vitest'
import { snoozeUntil, isSnoozed } from './snooze'

const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m)

describe('snoozeUntil', () => {
  it('returns three hours later inside waking hours', () => {
    expect(snoozeUntil(at(9, 41))).toEqual(at(12, 41))
  })
  it('moves a return at or after 21:00 to 09:00 the next day', () => {
    expect(snoozeUntil(at(18, 0))).toEqual(new Date(2026, 8, 29, 9, 0))
    expect(snoozeUntil(at(20, 30))).toEqual(new Date(2026, 8, 29, 9, 0))
  })
  it('moves a return before 09:00 to 09:00 the same day', () => {
    expect(snoozeUntil(at(2, 0))).toEqual(at(9, 0))
  })
})

describe('isSnoozed', () => {
  it('is snoozed only until the stored time', () => {
    const map = { a: at(12).toISOString() }
    expect(isSnoozed(map, 'a', at(11).getTime())).toBe(true)
    expect(isSnoozed(map, 'a', at(12, 1).getTime())).toBe(false)
    expect(isSnoozed(map, 'b', at(11).getTime())).toBe(false)
  })
})
