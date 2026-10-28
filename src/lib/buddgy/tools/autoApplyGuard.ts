/** Limits on what Buddgy may add without a tap. Beyond any of them the normal proposal card asks. */

export const AUTO_MAX_AMOUNT_BASE = 10_000
export const AUTO_DATE_WINDOW_DAYS = 7
export const AUTO_PER_MINUTE = 5
const MINUTE_MS = 60_000

const DAY_MS = 86_400_000

/** True when `date` is within `days` calendar days of `today` (both yyyy-MM-dd). */
export function withinDays(date: string, today: string, days: number): boolean {
  return Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) <= days * DAY_MS
}

const claimed: number[] = []

/** Takes one of the per-minute auto-apply slots; false when none are left. */
export function claimAutoSlot(now: number = Date.now()): boolean {
  while (claimed.length && now - claimed[0] >= MINUTE_MS) claimed.shift()
  if (claimed.length >= AUTO_PER_MINUTE) return false
  claimed.push(now)
  return true
}

export function resetAutoSlots(): void {
  claimed.length = 0
}
