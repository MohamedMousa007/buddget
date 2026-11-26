import { describe, expect, it } from 'vitest'
import { clockOf, editedDayFollowingAt, editedOccurredAt, entryOccurredAt, manualOccurredAt, mergeDayTime, noTimeAt, nowClock } from '@/lib/time/occurredAt'

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

describe('entryOccurredAt', () => {
  const now = new Date(2026, 10, 26, 9, 41, 7)

  it('today with no time picked is the current instant', () => {
    expect(entryOccurredAt('2026-11-26', '', now)).toBe(now.toISOString())
  })

  it('a picked time wins, today or another day', () => {
    expect(entryOccurredAt('2026-11-26', '20:42', now)).toBe(mergeDayTime('2026-11-26', '20:42'))
    expect(entryOccurredAt('2026-11-10', '07:05', now)).toBe(mergeDayTime('2026-11-10', '07:05'))
  })

  it('a back-dated row with no time gets the no-time stand-in, never today\'s clock', () => {
    const iso = entryOccurredAt('2026-11-10', '', now)
    expect(iso).toBe(noTimeAt('2026-11-10'))
    expect(clockOf(iso, '2026-11-10')).toBe('')
  })

  it('an unreadable day falls back to the current instant', () => {
    expect(entryOccurredAt('', '', now)).toBe(now.toISOString())
  })
})

describe('manualOccurredAt', () => {
  const now = new Date(2026, 10, 26, 9, 41, 7, 250)

  it('today with no time picked is the current instant', () => {
    expect(manualOccurredAt('2026-11-26', '', now)).toBe(now.toISOString())
  })

  it('a picked time wins', () => {
    expect(manualOccurredAt('2026-11-10', '07:05', now)).toBe(mergeDayTime('2026-11-10', '07:05'))
  })

  it('a back-dated entry with no time picked gets the current time of day on that day, as the pill showed', () => {
    const iso = manualOccurredAt('2026-11-10', '', now)
    expect(clockOf(iso, '2026-11-10')).toBe(nowClock(now))
    expect(new Date(iso).getDate()).toBe(10)
  })

  it('never lands on the no-time stand-in, even at exactly 12:00', () => {
    const noon = new Date(2026, 10, 26, 12, 0, 0, 0)
    expect(manualOccurredAt('2026-11-10', '', noon)).not.toBe(noTimeAt('2026-11-10'))
    expect(clockOf(manualOccurredAt('2026-11-10', '', noon), '2026-11-10')).toBe('12:00')
  })
})

describe('nowClock', () => {
  it('is the zero-padded clock time', () => {
    expect(nowClock(new Date(2026, 0, 1, 7, 5))).toBe('07:05')
  })
})

describe('editedDayFollowingAt', () => {
  const at = (day: string, h: number, m: number) => { const [y, mo, d] = day.split('-').map(Number); return new Date(y, mo - 1, d, h, m).toISOString() }
  it('moves to the new day as the no-time stand-in when no time was stored', () => {
    expect(editedDayFollowingAt('2026-05-03', '', { day: '2026-05-01', clock: '' })).toBe(noTimeAt('2026-05-03'))
    expect(editedDayFollowingAt('2026-05-03', '', { day: '2026-05-01', clock: '', at: noTimeAt('2026-05-01') })).toBe(noTimeAt('2026-05-03'))
  })
  it('keeps a stored time of day on the new day', () => {
    expect(editedDayFollowingAt('2026-05-03', '', { day: '2026-05-01', clock: '', at: at('2026-04-28', 9, 15) })).toBe(at('2026-05-03', 9, 15))
  })
  it('drops to the stand-in when the shown time was cleared', () => {
    expect(editedDayFollowingAt('2026-05-03', '', { day: '2026-05-01', clock: '09:15', at: at('2026-05-01', 9, 15) })).toBe(noTimeAt('2026-05-03'))
  })
  it('otherwise follows editedOccurredAt', () => {
    expect(editedDayFollowingAt('2026-05-03', '10:30', { day: '2026-05-01', clock: '' })).toBe(mergeDayTime('2026-05-03', '10:30'))
    expect(editedDayFollowingAt('2026-05-01', '', { day: '2026-05-01', clock: '' })).toBeUndefined()
  })
})
