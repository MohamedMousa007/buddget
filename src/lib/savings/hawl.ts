import { addDays, format, parseISO } from 'date-fns'
import { localDayKey } from '@/lib/utils/localDate'

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

/** `lastPaidDate` is a timestamp and `yearStartDate` a date: both reduce to the user's local day first. */
function addLunarYear(iso: string): string {
  const day = iso.length > 10 ? localDayKey(iso) : iso
  return format(addDays(parseISO(day), LUNAR_YEAR_DAYS), 'yyyy-MM-dd')
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
