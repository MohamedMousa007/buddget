const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Kept verbatim (microseconds): rounding to milliseconds could skip a row written in the same millisecond.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

/** `<timestamp ISO>|<id>` of the last row seen; null when absent or malformed (then the first page is served). */
export function parseTimeIdCursor(raw: string | null): { ts: string; id: string } | null {
  const [ts, id] = (raw ?? '').split('|')
  return ts && TIMESTAMP.test(ts) && Number.isFinite(Date.parse(ts)) && id && UUID.test(id) ? { ts, id } : null
}

export const formatTimeIdCursor = (ts: string, id: string) => `${ts}|${id}`

/** The PostgREST `or` filter for rows strictly older than `cursor` in (column desc, id desc) order. */
export const timeIdBefore = (column: string, cursor: { ts: string; id: string }) =>
  `${column}.lt.${cursor.ts},and(${column}.eq.${cursor.ts},id.lt.${cursor.id})`
