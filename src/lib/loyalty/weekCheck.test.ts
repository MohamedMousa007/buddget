import { describe, expect, it } from 'vitest'
import { weekCheckState } from './weekCheck'
import type { WeekSummary } from './loyaltyApi'

const base: WeekSummary = { thisWeek: '2026-11-15', lastWeek: '2026-11-08', lastWeekOpen: true, thisWeekKept: false, lastWeekKept: false, unconfirmedThisWeek: 0, unconfirmedLastWeek: 0, streakWeeks: 0, freezesBanked: 0, keptWeeksTotal: 0, recordsThisWeek: 3, recordsLastWeek: 3, recordsNeeded: 3, multiplier: 1 }

describe('weekCheckState', () => {
  it('asks for last week while it is open and not kept', () => {
    expect(weekCheckState(base, new Date(2026, 10, 16))).toEqual({ due: true, week: 'last' })
  })
  it('does not nag mid-week', () => {
    expect(weekCheckState({ ...base, lastWeekOpen: false }, new Date(2026, 10, 18))).toMatchObject({ due: false })
  })
  it('asks for this week on the last two days, and not once it is kept', () => {
    const late = { ...base, lastWeekOpen: false }
    expect(weekCheckState(late, new Date(2026, 10, 20))).toEqual({ due: true, week: 'this' })
    expect(weekCheckState({ ...late, thisWeekKept: true }, new Date(2026, 10, 20))).toEqual({ due: false, week: null })
  })
  it('nothing without a summary', () => {
    expect(weekCheckState(null)).toEqual({ due: false, week: null })
  })
})
