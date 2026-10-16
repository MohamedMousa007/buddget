import { describe, expect, it } from 'vitest'
import { debtFreeBy, lastPaymentDate, monthProgress, paymentsToClear } from '../heroStats'

describe('heroStats', () => {
  it('lastPaymentDate offsets remaining-1 cycles', () => {
    const d = lastPaymentDate(new Date(2026, 0, 15), 'monthly', 4)!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 3, 15])
    const w = lastPaymentDate(new Date(2026, 0, 1), 'biweekly', 3)!
    expect([w.getMonth(), w.getDate()]).toEqual([0, 29])
    expect(lastPaymentDate(new Date(2026, 0, 1), 'monthly', 0)).toBeNull()
  })

  it('paymentsToClear rounds up and guards zero', () => {
    expect(paymentsToClear(1000, 300)).toBe(4)
    expect(paymentsToClear(0, 300)).toBe(0)
    expect(paymentsToClear(100, 0)).toBe(0)
  })

  it('debtFreeBy picks the latest and counts unplanned', () => {
    const a = new Date(2026, 5, 1)
    const b = new Date(2027, 1, 1)
    expect(debtFreeBy([a, null, b])).toEqual({ date: b, unplanned: 1 })
    expect(debtFreeBy([null])).toEqual({ date: null, unplanned: 1 })
    expect(debtFreeBy([])).toEqual({ date: null, unplanned: 0 })
  })

  it('monthProgress', () => {
    expect(monthProgress(33000, 3000)).toEqual({ paid: 33000, total: 36000, pct: 92 })
    expect(monthProgress(0, 0).pct).toBe(0)
    expect(monthProgress(500, 0).pct).toBe(100)
  })
})
