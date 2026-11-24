/** One id, so scheduling again replaces the pending reminder and cancelling finds it. */
export const REMINDER_ID = 41027
/** Local hour the reminder is due. */
export const REMINDER_HOUR = 19
/** At most one reminder in this long. */
export const REMINDER_GAP_MS = 7 * 86_400_000
/** A reminder never fires sooner than this after it is scheduled, so it cannot land while the user is still in the app. */
const MIN_LEAD_MS = 2 * 3_600_000

/** The next 7 pm that is at least two hours away. */
export function nextReminderAt(now: Date): Date {
  const at = new Date(now)
  at.setHours(REMINDER_HOUR, 0, 0, 0)
  if (at.getTime() - now.getTime() < MIN_LEAD_MS) at.setDate(at.getDate() + 1)
  return at
}

/**
 * A reminder is scheduled only while the page leads with findings the user has not seen, and no reminder went out in
 * the last week. `sig` is empty until the ledger is ready, which never counts as new.
 */
export function reminderDue(i: { sig: string; seen: string | null; remindedAt: number | null; now: number }): boolean {
  if (i.sig === '' || i.sig === i.seen) return false
  return i.remindedAt === null || i.now - i.remindedAt >= REMINDER_GAP_MS
}

/** A pending reminder is cancelled only once the user has seen what it is about; a not-yet-ready ledger cancels nothing. */
export const reminderObsolete = (sig: string, seen: string | null): boolean => sig !== '' && sig === seen
