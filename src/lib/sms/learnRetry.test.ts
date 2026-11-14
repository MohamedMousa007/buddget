import { describe, expect, it } from 'vitest'
import { SKIPPED_COOLDOWN, classifyLearnStatus, encodeLearnStatus, planLearnAttempt } from './learnRetry'

const NOW = new Date('2026-11-14T12:00:00Z')
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

describe('P2-4: one model attempt per message, paced by the shape\'s last failure', () => {
  it('no history, or a terminal outcome, attempts with no hint', () => {
    expect(planLearnAttempt(null, NOW)).toEqual({ skip: false, hint: null, attempt: 1 })
    expect(planLearnAttempt({ status: 'learned', at: ago(1) }, NOW)).toEqual({ skip: false, hint: null, attempt: 1 })
  })
  it('skips a failure class that is still cooling down', () => {
    expect(planLearnAttempt({ status: encodeLearnStatus('regex_loose', 1, 'too greedy'), at: ago(2) }, NOW).skip).toBe(true)
  })
  it('attempts after the cool-down, with the failure\'s hint and the next attempt number', () => {
    const plan = planLearnAttempt({ status: encodeLearnStatus('regex_loose', 1, 'too greedy'), at: ago(7) }, NOW)
    expect(plan).toMatchObject({ skip: false, attempt: 2 })
    expect(plan.hint).toMatch(/lazy bounded/)
  })
  it('skips when the class is out of attempts, however old the failure', () => {
    expect(planLearnAttempt({ status: encodeLearnStatus('gate_rejected', 2, 'x'), at: ago(500) }, NOW).skip).toBe(true)
  })
  it('a bad datetime has no cool-down but a budget of two', () => {
    expect(planLearnAttempt({ status: encodeLearnStatus('bad_datetime', 1, 'x'), at: ago(0) }, NOW).skip).toBe(false)
    expect(planLearnAttempt({ status: encodeLearnStatus('bad_datetime', 2, 'x'), at: ago(0) }, NOW).skip).toBe(true)
  })
  it('the skip status is terminal, so it never counts as a failure of its own', () => {
    expect(classifyLearnStatus(SKIPPED_COOLDOWN)).toBe('terminal')
  })
})
