import { addMonths, format, setDate } from 'date-fns'

/** First automated run after the user’s initial deposit (next month, same calendar day, clamped 1–28). */
export function nextRecurringSavingsDueDate(dayOfMonth: number): string {
  const dom = Math.min(28, Math.max(1, Math.floor(dayOfMonth)))
  const next = setDate(addMonths(new Date(), 1), dom)
  return format(next, 'yyyy-MM-dd')
}
