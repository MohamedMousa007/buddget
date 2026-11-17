import { describe, expect, it } from 'vitest'
import { capCheck, clawbackDue, evaluatePending, isActivated, milestoneAt, progress, rewardKind } from './rules'

const DAY = 86_400_000
const T0 = new Date(Date.UTC(2026, 10, 1))
const at = (days: number) => new Date(T0.getTime() + days * DAY)

describe('activation', () => {
  it('needs 3 active days and 5 records', () => {
    expect(isActivated(3, 5)).toBe(true)
    expect(isActivated(2, 50)).toBe(false)
    expect(isActivated(10, 4)).toBe(false)
  })
  it('inside 14 days stays pending, then expires; activation wins whenever it is met', () => {
    expect(evaluatePending(2, 5, T0, at(13))).toBe('pending')
    expect(evaluatePending(2, 5, T0, at(14))).toBe('expired')
    expect(evaluatePending(3, 5, T0, at(14))).toBe('activated')
  })
  it('shows capped progress', () => {
    expect(progress(2, 9)).toEqual({ days: 2, daysNeeded: 3, records: 5, recordsNeeded: 5 })
  })
})

describe('caps', () => {
  it('4 a month, 12 a year', () => {
    expect(capCheck(3, 3)).toBe('ok')
    expect(capCheck(4, 4)).toBe('month_cap')
    expect(capCheck(0, 12)).toBe('year_cap')
    expect(capCheck(4, 12)).toBe('year_cap')
  })
})

describe('rewards', () => {
  it('milestones at 3, 5 and 10 activated friends', () => {
    expect(milestoneAt(2)).toBeNull()
    expect(milestoneAt(3)).toEqual({ kind: 'points', amount: 50 })
    expect(milestoneAt(5)).toEqual({ kind: 'points', amount: 100 })
    expect(milestoneAt(10)).toEqual({ kind: 'card_finish', item: 'connector' })
    expect(milestoneAt(11)).toBeNull()
  })
  it('a paying store subscriber gets Sparks, everyone else a banked Pro week', () => {
    expect(rewardKind(true)).toBe('sparks')
    expect(rewardKind(false)).toBe('pro_week')
  })
  it('claws back a paid reward when the friend is deleted within 30 days', () => {
    expect(clawbackDue('rewarded', T0, at(29))).toBe(true)
    expect(clawbackDue('rewarded', T0, at(30))).toBe(false)
    expect(clawbackDue('pending', T0, at(1))).toBe(false)
  })
})
