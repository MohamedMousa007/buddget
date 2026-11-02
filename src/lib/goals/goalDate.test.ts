import { describe, expect, it } from 'vitest'
import { isThisMonthOrLater, localPromptDay } from './goalDate'
import { parseGoalReply } from './goalAi'

// 2026-11-30 22:30Z is already 1 December in Cairo.
const lateNov = new Date('2026-11-30T22:30:00Z')

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
