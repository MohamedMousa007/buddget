import type { ServiceClient } from '@/lib/supabase/service'

/** How far apart two captures of one text may be and still be one possible second copy (I5). */
export const SECOND_COPY_WINDOW_MS = 3 * 60_000

export interface CopyRow {
  id: string
  status: string | null
  received_at: string
  captured_at: string | null
  expense_id: string | null
  income_id: string | null
}

type Ordered = Pick<CopyRow, 'id' | 'received_at'>

/**
 * True when `self` is the later of the two: later receive time, and on a tie the greater id. The tie-break matters
 * because two requests can land on the same instant; exactly one of them must read as "the later copy", or both
 * would stand down (or both act).
 */
export function isLaterCopy(self: Ordered, other: Ordered): boolean {
  const a = Date.parse(self.received_at)
  const b = Date.parse(other.received_at)
  if (a !== b) return a > b
  return self.id > other.id
}

/**
 * The live rows `self` is a later copy of: same text (the query), a different capture time or an unknown one, received
 * within the window. Two rows with the same known capture time are one capture, which the unique index refuses, so
 * one is never listed here.
 */
export function earlierCopies(self: Pick<CopyRow, 'id' | 'received_at' | 'captured_at'>, rows: readonly CopyRow[]): CopyRow[] {
  const at = Date.parse(self.received_at)
  return rows.filter((r) =>
    r.id !== self.id &&
    !(r.captured_at && self.captured_at && Date.parse(r.captured_at) === Date.parse(self.captured_at)) &&
    Math.abs(Date.parse(r.received_at) - at) <= SECOND_COPY_WINDOW_MS &&
    isLaterCopy(self, r))
}

/**
 * What a later copy of a text is. A payment reference or a running balance is printed once per real movement, so the
 * same one twice is the same movement. Without either, two identical texts minutes apart may be two real purchases
 * (twin coffees), so the later one is booked and flagged, never dropped. A printed time of day proves nothing.
 */
export function secondCopyVerdict(i: { hasReference: boolean; hasBalance: boolean }): 'proven_duplicate' | 'possible_duplicate' {
  return i.hasReference || i.hasBalance ? 'proven_duplicate' : 'possible_duplicate'
}

/**
 * The earlier live copy of this message's text, when this message is the later one. Read AFTER this message's own
 * claim row exists, so two simultaneous requests see each other and exactly one of them is the later copy.
 * Rows that failed or were rejected never booked anything and are not copies. A claim still `processing` is returned
 * like any other: the caller must not answer success on it, since that run may still die.
 */
export async function findEarlierCopy(
  service: ServiceClient,
  i: { userId: string; logId: string; bodyHash: string; capturedAt: string | null; receivedAt: string },
): Promise<CopyRow | null> {
  const at = Date.parse(i.receivedAt)
  if (!Number.isFinite(at)) return null
  const { data } = await service
    .from('sms_parse_log')
    .select('id, status, received_at, captured_at, expense_id, income_id')
    .eq('user_id', i.userId)
    .eq('body_hash', i.bodyHash)
    .eq('is_duplicate', false)
    .neq('id', i.logId)
    .not('status', 'in', '(failed,rejected)')
    .gte('received_at', new Date(at - SECOND_COPY_WINDOW_MS).toISOString())
    .lte('received_at', new Date(at + SECOND_COPY_WINDOW_MS).toISOString())
  const mine = { id: i.logId, received_at: i.receivedAt, captured_at: i.capturedAt }
  const earlier = earlierCopies(mine, (data ?? []) as CopyRow[])
  return earlier.find((r) => r.status !== 'processing') ?? earlier[0] ?? null
}
