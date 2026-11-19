import type { Snapshot } from '@/lib/supabase/remote'
import { serverInstant } from '@/lib/supabase/remote/serverClock'

type Row = { id: string; updatedAt?: string }
export type SentRows = Map<string, { slice: keyof Snapshot; row: Row }>

/** The rows a flush sent: those of `next` that are not the object the baseline holds. */
export function sentRows(prev: Snapshot, next: Snapshot): SentRows {
  const out: SentRows = new Map()
  for (const slice of Object.keys(next) as (keyof Snapshot)[]) {
    const rows = next[slice]
    const before = prev[slice]
    if (!Array.isArray(rows) || !Array.isArray(before) || rows === before) continue
    const known = new Map((before as Row[]).map((r) => [r.id, r]))
    for (const row of rows as Row[]) if (known.get(row.id) !== row) out.set(row.id, { slice, row })
  }
  return out
}

/** Clock-offset noise between the device stamp and the server's copy of the same edit. */
const SAME_EDIT_MS = 2_000

/**
 * How many of those rows now hold someone else's newer edit (newest edit wins), or are gone: the edits this device
 * made that did not survive. A row that came back with the edit time it was sent with is this device's own.
 */
export function countReplaced(sent: SentRows, now: Snapshot): number {
  let n = 0
  for (const { slice, row } of sent.values()) {
    const current = (now[slice] as unknown as Row[]).find((r) => r.id === row.id)
    if (current === row) continue
    const mine = serverInstant(row.updatedAt)
    const theirs = current ? Date.parse(current.updatedAt ?? '') : NaN
    if (!current || (mine !== null && !Number.isNaN(theirs) && theirs > mine + SAME_EDIT_MS)) n++
  }
  return n
}
