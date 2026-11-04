import { describe, expect, it } from 'vitest'
import { isThisMonthOrLater, localPromptDay } from './goalDate'
import { parseGoalReply } from './goalAi'

// 2026-11-30 22:30Z is already 1 December in Cairo.
// Half past midnight on 1 Dec LOCAL time: in any zone ahead of UTC the UTC date is still 30 Nov, which is what the tests guard.
const lateNov = new Date(2026, 11, 1, 0, 30)

describe('local month for goal dates (T18)', () => {
  it('uses the local month, not UTC', () => {
    expect(isThisMonthOrLater('2026-11-01', lateNov)).toBe(false)
    expect(isThisMonthOrLater('2026-12-01', lateNov)).toBe(true)
    expect(localPromptDay(lateNov)).toBe('2026-12-01')
  })
  it('drops last month for a goal parsed at local month start', () => {
    const g = parseGoalReply('{"category":"vacation","name":"x","date":"2026-11"}', lateNov)
    expect(g.date).toBeUndefined()
  })
})
