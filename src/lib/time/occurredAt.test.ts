import { describe, expect, it } from 'vitest'
import { clockOf, editedOccurredAt, mergeDayTime, noTimeAt } from '@/lib/time/occurredAt'

describe('mergeDayTime', () => {
  it('puts the picked clock time on the local day', () => {
    const iso = mergeDayTime('2026-10-27', '20:42')!
    const at = new Date(iso)
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 9, 27, 20, 42])
  })

  it('keeps midnight and the last minute on the same day', () => {
    expect(new Date(mergeDayTime('2026-10-27', '00:00')!).getDate()).toBe(27)
    expect(new Date(mergeDayTime('2026-10-27', '23:59')!).getDate()).toBe(27)
  })

  it('is undefined for an empty or malformed time, so the store keeps its default', () => {
    expect(mergeDayTime('2026-10-27', '')).toBeUndefined()
    expect(mergeDayTime('2026-10-27', '24:00')).toBeUndefined()
    expect(mergeDayTime('2026-10-27', '7:5')).toBeUndefined()
  })
})

describe('clockOf', () => {
  it('reads the clock back from a merged instant (round trip)', () => {
    expect(clockOf(mergeDayTime('2026-10-27', '09:05'), '2026-10-27')).toBe('09:05')
  })

  it('is empty for no time, another day, or the noon stand-in', () => {
    expect(clockOf(undefined, '2026-10-27')).toBe('')
    expect(clockOf(mergeDayTime('2026-10-26', '09:05'), '2026-10-27')).toBe('')
    expect(clockOf(new Date(2026, 9, 27, 12, 0, 0, 0).toISOString(), '2026-10-27')).toBe('')
    expect(clockOf(noTimeAt('2026-10-27'), '2026-10-27')).toBe('')
  })

  it('keeps a picked 12:00 apart from the noon stand-in', () => {
    expect(clockOf(mergeDayTime('2026-10-27', '12:00'), '2026-10-27')).toBe('12:00')
    expect(mergeDayTime('2026-10-27', '12:00')).not.toBe(noTimeAt('2026-10-27'))
  })
})

describe('editedOccurredAt', () => {
  const saved = { day: '2026-10-27', clock: '09:05' }
  it('sends the picked instant when the time or the day changed', () => {
    expect(editedOccurredAt('2026-10-27', '10:00', saved)).toBe(mergeDayTime('2026-10-27', '10:00'))
    expect(editedOccurredAt('2026-10-28', '09:05', saved)).toBe(mergeDayTime('2026-10-28', '09:05'))
  })
  it('sends nothing when the time is untouched', () => {
    expect(editedOccurredAt('2026-10-27', '09:05', saved)).toBeUndefined()
    expect(editedOccurredAt('2026-10-27', '', { day: '2026-10-27', clock: '' })).toBeUndefined()
  })
  it('a cleared time on the same day sends the no-time stand-in; on a new day the store re-dates it', () => {
    expect(editedOccurredAt('2026-10-27', '', saved)).toBe(noTimeAt('2026-10-27'))
    expect(editedOccurredAt('2026-10-28', '', saved)).toBeUndefined()
  })
})
