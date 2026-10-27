import { describe, expect, it } from 'vitest'
import { monthNameInZone } from './zonedMonth'

describe('monthNameInZone', () => {
  it('uses the user zone at the month boundary, not UTC', () => {
    const now = new Date('2026-10-31T22:30:00Z')
    expect(monthNameInZone(now, 'Africa/Cairo', 'en')).toBe('November')
    expect(monthNameInZone(now, 'UTC', 'en')).toBe('October')
  })
})
