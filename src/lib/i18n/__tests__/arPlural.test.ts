import { describe, expect, it } from 'vitest'
import { arCount } from '../arPlural'
import { ar } from '../dictionaries/ar'

describe('arPlural', () => {
  it('uses singular, dual, plural and accusative forms', () => {
    expect(arCount(1, 'day')).toBe('يوم واحد')
    expect(arCount(2, 'day')).toBe('يومين')
    expect(arCount(3, 'day')).toBe('3 أيام')
    expect(arCount(10, 'day')).toBe('10 أيام')
    expect(arCount(11, 'day')).toBe('11 يومًا')
    expect(arCount(100, 'day')).toBe('100 يوم')
    expect(arCount(101, 'day')).toBe('101 يوم')
    expect(arCount(102, 'day')).toBe('102 يوم')
    expect(arCount(103, 'day')).toBe('103 أيام')
    expect(arCount(111, 'day')).toBe('111 يومًا')
    expect(arCount(-1, 'day')).toBe('يوم واحد')
    expect(arCount(-5, 'day')).toBe('-5 أيام')
    expect(arCount(1, 'payment')).toBe('دفعة واحدة')
    expect(arCount(11, 'payment')).toBe('11 دفعة')
  })
  it('is wired into the dictionary count strings', () => {
    expect(ar.debts.fPaymentsCount(1)).not.toBe('1 دفعات')
    expect(ar.debts.fPaymentsCount(11)).toBe('11 دفعة')
    expect(ar.debts.fPaymentsCount(2)).toBe('دفعتين')
    expect(ar.income.sourcesCount(2)).toBe('مصدرين')
    expect(ar.reports.timesUsed(11)).toBe('(11 مرة)')
  })
  it('month-end strings read correctly for every count class', () => {
    for (const n of [1, 2, 3, 10, 11, 100]) {
      const out = [ar.common.daysLeft(n), ar.notifications.monthEndTitleDays(n), ar.notifications.monthEndBodyDays(n)]
      for (const s of out) expect(s).not.toContain('متبقية')
    }
  })
})
