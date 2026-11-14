import type { IncomeEvent } from '@/lib/store/types'

/** Titles the app writes when a credit names nobody. They are not a sender. */
const GENERIC = new Set(['bank credit', 'salary', 'bank transaction'])
const PREFIX = /^transfer\s+from\b\s*/i

/**
 * Who a credit came from, read from the user's OWN transaction title ("Transfer from X" as the app titled it from the
 * bank message). Nothing is fetched: the server log no longer keeps the names of the people in a user's transfers.
 * Null when the title names nobody.
 */
export function creditSenderFromTitle(event: Pick<IncomeEvent, 'name'> | undefined): string | null {
  const title = event?.name?.trim() ?? ''
  if (!title || GENERIC.has(title.toLowerCase())) return null
  const sender = title.replace(PREFIX, '').trim()
  return sender || null
}
