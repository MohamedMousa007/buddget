/**
 * The hawl (الحول) — the lunar year wealth must sit above nisab before zakat is owed.
 *
 * It runs from when the user's wealth **first passed nisab**, or from when they last
 * paid. It does **not** run from when they installed a budgeting app, which is what
 * anchoring to `createdAt` actually meant before this existed: a date with no religious
 * meaning, presented as "due by".
 *
 * We cannot know when someone's wealth crossed the line — it usually happened long
 * before they opened Buddget — so the user sets it. Many people keep a fixed Hijri
 * anchor (1 Ramadan is common). Until they set one we still show a date, because a
 * blank is less useful than an estimate, but {@link Hawl.isPlaceholder} tells the UI to
 * say plainly that it is a guess.
 */

export interface HawlInput {
  /** The user's own zakat-year anchor, ISO date. The only authoritative source. */
  yearStartDate?: string | null
  /** When zakat was last paid — the next year runs from there. */
  lastPaidDate?: string | null
  /** Account creation. A fallback, never a real anchor. */
  createdAt: string
}

export interface Hawl {
  /** When the lunar year completes, ISO (YYYY-MM-DD). */
  dueDate: string
  /**
   * True when neither a year-start nor a last-paid date was set, so the date was
   * derived from account creation. The UI must not present this as fact.
   */
  isPlaceholder: boolean
}

/** A lunar year. Zakat is reckoned on the Hijri calendar, which runs ~354 days. */
export const LUNAR_YEAR_DAYS = 354

function addLunarYear(iso: string): string {
  return new Date(new Date(iso).getTime() + LUNAR_YEAR_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
}

function usable(d: string | null | undefined): d is string {
  return typeof d === 'string' && d.length > 0 && !Number.isNaN(new Date(d).getTime())
}

/**
 * Precedence: the anchor the user set, then when they last paid, then account creation
 * as a labelled guess.
 */
export function deriveHawl(input: HawlInput): Hawl {
  if (usable(input.yearStartDate)) {
    return { dueDate: addLunarYear(input.yearStartDate), isPlaceholder: false }
  }
  if (usable(input.lastPaidDate)) {
    return { dueDate: addLunarYear(input.lastPaidDate), isPlaceholder: false }
  }
  return { dueDate: addLunarYear(input.createdAt), isPlaceholder: true }
}
