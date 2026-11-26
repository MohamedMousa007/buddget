import { safeLocalDayKey } from '@/lib/utils/localDate'

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

const DAY = /^\d{4}-\d{2}-\d{2}$/

const localAt = (day: string, h: number, min: number, sec: number): string => {
  const [y, mo, d] = day.slice(0, 10).split('-').map(Number)
  return new Date(y, mo - 1, d, h, min, sec, 0).toISOString()
}

/** The "no time" stand-in for a day: local 12:00:00.000, which {@link clockOf} reads back as ''. */
export const noTimeAt = (day: string): string => localAt(day, 12, 0, 0)

/**
 * The instant a transaction happened from its local day (`yyyy-MM-dd`) and a picked clock time (`HH:mm`), as ISO.
 * `undefined` when the time is empty or malformed, so the store keeps its own rule (now for today, noon otherwise).
 * A picked 12:00 is stored one second past, so it never reads back as the "no time" stand-in.
 */
export function mergeDayTime(day: string, time: string): string | undefined {
  const m = CLOCK.exec(time)
  if (!m || !DAY.test(day.slice(0, 10))) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  return localAt(day, h, min, h === 12 && min === 0 ? 1 : 0)
}

/**
 * The `occurredAt` an edit sends: the picked instant when the time or day changed, the "no time" stand-in when a saved
 * time was cleared on the same day, and `undefined` otherwise (the store keeps its own rule for a re-dated row).
 */
export function editedOccurredAt(day: string, clock: string, saved: { day: string; clock: string }): string | undefined {
  if (clock) return clock !== saved.clock || day !== saved.day ? mergeDayTime(day, clock) : undefined
  return saved.clock && day === saved.day && DAY.test(day.slice(0, 10)) ? noTimeAt(day) : undefined
}

/**
 * The `HH:mm` an existing row shows in the time field: its own clock time when `occurredAt` falls on its day, and ''
 * for no real time (absent, another day, or the exact local 12:00:00.000 stand-in a re-dated row is given).
 */
export function clockOf(occurredAt: string | null | undefined, day: string): string {
  if (!occurredAt || safeLocalDayKey(occurredAt) !== day.slice(0, 10)) return ''
  const at = new Date(occurredAt)
  if (at.getHours() === 12 && at.getMinutes() === 0 && at.getSeconds() === 0 && at.getMilliseconds() === 0) return ''
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}
