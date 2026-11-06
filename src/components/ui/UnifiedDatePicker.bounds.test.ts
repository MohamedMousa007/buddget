import { describe, it, expect } from 'vitest'
import { pickerBounds, pickerYears } from '@/lib/time/monthGrid'

describe('date picker bounds (FRM-13)', () => {
  it('default span matches the year list: 1970 to 50 years ahead', () => {
    const now = new Date(2026, 10, 6)
    const years = pickerYears(now)
    expect(pickerBounds(now)).toEqual({ min: `${years[0]}-01-01`, max: `${years[years.length - 1]}-12-31` })
    expect(pickerBounds(now)).toEqual({ min: '1970-01-01', max: '2076-12-31' })
  })
})
