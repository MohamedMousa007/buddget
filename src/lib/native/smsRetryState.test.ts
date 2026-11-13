import { describe, expect, it } from 'vitest'
import { isDue, nextDelayMs, retryAfterMs } from './smsRetryState'

const mid = () => 0.5

describe('nextDelayMs', () => {
  it('doubles from a minute and caps at an hour', () => {
    expect(nextDelayMs(1, { random: () => 1 })).toBe(60_000)
    expect(nextDelayMs(3, { random: () => 1 })).toBe(240_000)
    expect(nextDelayMs(30, { random: () => 1 })).toBe(3_600_000)
  })

  it('jitters between half and the full ceiling so phones that failed together do not retry together', () => {
    expect(nextDelayMs(4, { random: () => 0 })).toBe(240_000)
    expect(nextDelayMs(4, { random: () => 1 })).toBe(480_000)
  })

  it('parks a message the server refuses for itself on a slower, 6 hour schedule', () => {
    expect(nextDelayMs(30, { poison: true, random: () => 1 })).toBe(6 * 3_600_000)
  })

  it('never retries sooner than the server asked', () => {
    expect(nextDelayMs(1, { random: mid, retryAfterMs: 20 * 60_000 })).toBe(20 * 60_000)
  })
})

describe('retryAfterMs', () => {
  it('reads seconds, dates and garbage', () => {
    expect(retryAfterMs('120')).toBe(120_000)
    expect(retryAfterMs('Thu, 01 Jan 2026 00:05:00 GMT', Date.parse('2026-01-01T00:00:00Z'))).toBe(300_000)
    expect(retryAfterMs('soon')).toBe(0)
    expect(retryAfterMs(null)).toBe(0)
  })
})

describe('isDue', () => {
  it('is due with no record or once nextAt has passed', () => {
    expect(isDue(undefined)).toBe(true)
    expect(isDue({ attempts: 1, nextAt: 10, lastError: 'x' }, 11)).toBe(true)
    expect(isDue({ attempts: 1, nextAt: 10, lastError: 'x' }, 9)).toBe(false)
  })
})
