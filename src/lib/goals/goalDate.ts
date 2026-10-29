import { format } from 'date-fns'

/** A stated goal month (`yyyy-MM-01`) counts when it is this month or later, in the user's local calendar. */
export function isThisMonthOrLater(monthStart: string, now: Date): boolean {
  return monthStart.slice(0, 7) >= format(now, 'yyyy-MM')
}

/** "Today" for AI prompts: the user's local day, not UTC. */
export const localPromptDay = (now: Date): string => format(now, 'yyyy-MM-dd')
