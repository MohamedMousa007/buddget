import { describe, expect, it, vi } from 'vitest'
import { calculateGoalPayment } from '../calculateGoalPayment'

describe('calculateGoalPayment', () => {
  it('rounds up to cents without float noise (1.1 per period, not 1.11)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const r = calculateGoalPayment(11, '2026-01-11T00:00:00Z', 'weekly')
    expect(r.totalPeriods).toBe(2)
    expect(r.amountPerPeriod).toBe(5.5)
    expect(calculateGoalPayment(3.3, '2026-01-02T00:00:00Z', 'weekly').amountPerPeriod).toBe(3.3)
    vi.useRealTimers()
  })
})
