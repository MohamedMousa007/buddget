import { format, parseISO } from 'date-fns'

/** `yyyy-MM-dd` → "Sep 22" — the ledger's short date, always Latin (rendered mono). */
export function shortDate(iso: string): string {
  return format(parseISO(iso.slice(0, 10)), 'MMM d')
}
