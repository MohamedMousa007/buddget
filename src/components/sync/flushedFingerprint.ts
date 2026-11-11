import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote'

/**
 * What the server last received, as one short hash per row (not a second copy of the data). At a warm start the
 * persisted store is not the server: edits made offline, or inside a failed retry, are in the cache but never
 * reached it. Comparing the cache with these hashes finds exactly those rows, so the first flush sends them.
 */
export interface Fingerprint {
  /** Hash format: 2 = two independent 32-bit hashes plus the length. An older fingerprint is ignored (the first boot after the upgrade trusts the cache). */
  v: 2
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

const rowHashes = new WeakMap<object, string>()

/** Store rows are replaced, never mutated, so a row object seen before keeps its hash: only changed rows are re-serialised. */
function rowHash(row: object): string {
  const known = rowHashes.get(row)
  if (known !== undefined) return known
  const h = hash(row)
  rowHashes.set(row, h)
  return h
}

function hash(value: unknown): string {
  const s = stable(value)
  let h1 = 0x811c9dc5
  let h2 = 0x9747b28c
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x5bd1e995)
    h2 ^= h2 >>> 15
  }
  return `${s.length.toString(36)}.${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`
}

export function fingerprintOf(snap: Snapshot): Fingerprint {
  const lists: Fingerprint['lists'] = {}
  const singles: Fingerprint['singles'] = {}
  for (const [key, value] of Object.entries(snap)) {
    if (Array.isArray(value)) lists[key] = Object.fromEntries((value as Row[]).map((r) => [r.id, rowHash(r)]))
    else singles[key] = hash(value)
  }
  return { v: 2, lists, singles }
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
        prev.push(known[row.id] === rowHash(row) ? row : { ...row, __unsynced: true })
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
    const fp = JSON.parse(raw) as Partial<Fingerprint>
    return fp.v === 2 ? baselineFromFingerprint(cache, fp as Fingerprint) : cache
  } catch {
    return cache
  }
}
