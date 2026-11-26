import { safeLocalDayKey } from '@/lib/utils/localDate'

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * The instant a transaction happened from its local day (`yyyy-MM-dd`) and a picked clock time (`HH:mm`), as ISO.
 * `undefined` when the time is empty or malformed, so the store keeps its own rule (now for today, noon otherwise).
 */
export function mergeDayTime(day: string, time: string): string | undefined {
  const m = CLOCK.exec(time)
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(day.slice(0, 10))) return undefined
  const [y, mo, d] = day.slice(0, 10).split('-').map(Number)
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2]), 0, 0).toISOString()
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
