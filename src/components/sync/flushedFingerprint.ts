import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote'

/**
 * What the server last received, as one short hash per row (not a second copy of the data). At a warm start the
 * persisted store is not the server: edits made offline, or inside a failed retry, are in the cache but never
 * reached it. Comparing the cache with these hashes finds exactly those rows, so the first flush sends them.
 */
export interface Fingerprint {
  lists: Record<string, Record<string, string>>
  singles: Record<string, string>
}

type Row = { id: string }

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function hash(value: unknown): string {
  const s = stable(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${s.length.toString(36)}.${(h >>> 0).toString(36)}`
}

export function fingerprintOf(snap: Snapshot): Fingerprint {
  const lists: Fingerprint['lists'] = {}
  const singles: Fingerprint['singles'] = {}
  for (const [key, value] of Object.entries(snap)) {
    if (Array.isArray(value)) lists[key] = Object.fromEntries((value as Row[]).map((r) => [r.id, hash(r)]))
    else singles[key] = hash(value)
  }
  return { lists, singles }
}

/**
 * The snapshot the next flush should diff against: the cache with every row the server has not seen made to look
 * different. A row whose hash differs becomes an update, a row with no stored hash an insert, and a row that was
 * stored but is gone from the cache (deleted offline) a delete.
 */
export function baselineFromFingerprint(cache: Snapshot, fp: Fingerprint): Snapshot {
  const out = { ...cache } as Record<string, unknown>
  const blank = emptySnapshot() as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(cache)) {
    if (Array.isArray(value)) {
      const known = fp.lists[key] ?? {}
      const seen = new Set<string>()
      const prev: unknown[] = []
      for (const row of value as Row[]) {
        seen.add(row.id)
        if (!(row.id in known)) continue
        prev.push(known[row.id] === hash(row) ? row : { ...row, __unsynced: true })
      }
      for (const id of Object.keys(known)) if (!seen.has(id)) prev.push({ id })
      out[key] = prev
    } else if (fp.singles[key] !== undefined && fp.singles[key] !== hash(value)) {
      out[key] = blank[key]
    }
  }
  return out as unknown as Snapshot
}

const KEY = (userId: string) => `buddget:flushed:${userId}`

export function saveFingerprint(userId: string, snap: Snapshot): void {
  try { localStorage.setItem(KEY(userId), JSON.stringify(fingerprintOf(snap))) } catch { /* storage full or blocked: next boot trusts the cache, as before */ }
}

/** The cache itself when nothing was stored yet (first run after an upgrade), so no row is re-sent needlessly. */
export function baselineForBoot(userId: string, cache: Snapshot): Snapshot {
  try {
    const raw = localStorage.getItem(KEY(userId))
    if (!raw) return cache
    return baselineFromFingerprint(cache, JSON.parse(raw) as Fingerprint)
  } catch {
    return cache
  }
}
