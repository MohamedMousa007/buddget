/** A snoozed prompt comes back after this long… */
export const SNOOZE_MS = 3 * 60 * 60 * 1000
/** …but only inside waking hours (local). */
const OPEN_HOUR = 9
const CLOSE_HOUR = 21

/**
 * When a prompt snoozed at `now` returns: three hours later, moved to 09:00 when that
 * lands at or after 21:00 (next day) or before 09:00 (same day).
 */
export function snoozeUntil(now: Date): Date {
  const at = new Date(now.getTime() + SNOOZE_MS)
  const h = at.getHours()
  if (h >= CLOSE_HOUR) {
    const next = new Date(at)
    next.setDate(next.getDate() + 1)
    next.setHours(OPEN_HOUR, 0, 0, 0)
    return next
  }
  if (h < OPEN_HOUR) {
    const same = new Date(at)
    same.setHours(OPEN_HOUR, 0, 0, 0)
    return same
  }
  return at
}

/** True while `key` is snoozed at `now`. */
export function isSnoozed(snoozed: Record<string, string>, key: string, now: number): boolean {
  const until = snoozed[key]
  return Boolean(until) && Date.parse(until) > now
}
