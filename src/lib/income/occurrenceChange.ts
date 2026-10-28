import type { IncomeEvent } from '@/lib/store/types'

/** Linking an income event to a recurring source sets the payday it fulfils, unlinking clears it, so the two never disagree. */
export function occurrenceChange(
  event: Pick<IncomeEvent, 'templateId' | 'occurrenceDate'>,
  templateId: string,
  receivedDate: string,
): { occurrenceDate?: string | null } {
  if (!templateId) return { occurrenceDate: null }
  if (templateId !== (event.templateId ?? '') || !event.occurrenceDate) return { occurrenceDate: receivedDate }
  return {}
}
