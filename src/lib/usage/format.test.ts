import { describe, expect, it } from 'vitest'
import { resetLabel } from './format'

// BDG-012: a limit that comes back on another day must say which day, not only a clock time.
describe('resetLabel', () => {
  const now = new Date(2026, 10, 20, 10, 0).getTime()

  it('later today is a clock time only', () => {
    const label = resetLabel(new Date(2026, 10, 20, 14, 30).toISOString(), 'en', now)
    expect(label).toBe('14:30')
  })

  it('another day names the day and date as well as the time', () => {
    const label = resetLabel(new Date(2026, 10, 23, 9, 5).toISOString(), 'en', now)
    expect(label).toContain('23')
    expect(label).toContain('Nov')
    expect(label).toContain('09:05')
  })

  it('nothing to say without a valid time', () => {
    expect(resetLabel(null, 'en', now)).toBe('')
    expect(resetLabel('not a date', 'en', now)).toBe('')
  })
})
