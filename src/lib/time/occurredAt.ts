import { localTodayISO, safeLocalDayKey } from '@/lib/utils/localDate'

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
 * The `occurredAt` a new row is stored with: the picked clock time on its day; else `now` when the day is today (or
 * unreadable); else the "no time" stand-in, so a back-dated row never borrows today's clock.
 */
export function entryOccurredAt(day: string, clock = '', now: Date = new Date()): string {
  const picked = mergeDayTime(day, clock)
  if (picked) return picked
  const d = day.slice(0, 10)
  return DAY.test(d) && d !== localTodayISO(now) ? noTimeAt(d) : now.toISOString()
}

/** The clock time (`HH:mm`) of `now`: what a new manual entry's date+time pill shows until a time is picked. */
export function nowClock(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * The `occurredAt` a new entry typed by the user is stored with: the picked clock time; else the current instant for
 * today; else the picked day at the current time of day (what the pill showed). Never the "no time" stand-in, which
 * is kept for rows with no known time (automatic back-fills, re-dated rows).
 */
export function manualOccurredAt(day: string, clock = '', now: Date = new Date()): string {
  const picked = mergeDayTime(day, clock)
  if (picked) return picked
  const d = day.slice(0, 10)
  if (!DAY.test(d) || d === localTodayISO(now)) return now.toISOString()
  const at = new Date(localAt(d, now.getHours(), now.getMinutes(), now.getSeconds()))
  at.setMilliseconds(now.getMilliseconds())
  // Off the stand-in instant even when the clock reads exactly 12:00:00.000.
  return (at.toISOString() === noTimeAt(d) ? new Date(at.getTime() + 1) : at).toISOString()
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
 * The `occurredAt` an edit sends for a row whose instant must follow its day (a debt's principal move): as
 * {@link editedOccurredAt}, and when only the day changed with no time picked, the saved instant's time of day on the
 * new day, or the "no time" stand-in when nothing was saved or the shown time was cleared.
 */
export function editedDayFollowingAt(day: string, clock: string, saved: { day: string; clock: string; at?: string }): string | undefined {
  const edited = editedOccurredAt(day, clock, saved)
  if (edited || clock || day === saved.day || !DAY.test(day.slice(0, 10))) return edited
  const prev = saved.at ? new Date(saved.at) : null
  if (saved.clock || !prev || Number.isNaN(prev.getTime())) return noTimeAt(day)
  const [y, mo, d] = day.slice(0, 10).split('-').map(Number)
  prev.setFullYear(y, mo - 1, d)
  return prev.toISOString()
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
