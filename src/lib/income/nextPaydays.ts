import { addDays, startOfDay } from 'date-fns'
import { paydayDatesForWindow, type WeekendFirstDay } from '@/lib/utils/paydaySchedule'
import type { IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

/** How far ahead the Add income source preview looks: enough for three monthly paydays. */
const LOOKAHEAD_DAYS = 100

/**
 * The next `n` paydays a source being added would have, from today on, with the weekend rule applied: the "Next dates"
 * preview in Add income source. An irregular source has no fixed day, so it has none.
 */
export function nextPaydays(
  draft: { frequency: IncomeRecurringFrequency; paydays: number[]; irregular?: boolean },
  today: Date,
  n = 3,
  weekendFirst?: WeekendFirstDay,
): Date[] {
  if (draft.irregular || !draft.paydays.length) return []
  const from = startOfDay(today)
  const source = {
    recurringFrequency: draft.frequency,
    dayOfMonth: draft.paydays[0],
    paydayDays: draft.paydays,
  } as IncomeSource
  return paydayDatesForWindow(source, from, addDays(from, LOOKAHEAD_DAYS), false, weekendFirst).filter((d) => d >= from).slice(0, n)
}
