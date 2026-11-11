const KEY = 'bdg-server-clock-offset-v2'

/** A stored offset older than this is not trusted: the device clock may have been corrected since it was learned. */
const MAX_STORED_AGE_MS = 3 * 24 * 60 * 60 * 1000

/** A pull only moves the offset by more than this: the measurement carries the round-trip latency, which must not shift stamps already sent. */
const RELEARN_THRESHOLD_MS = 2000

/** Server time minus device time, in ms, as of the last pull. Null until a pull has told. */
let offsetMs: number | null = null
let loaded = false

function learned(): number | null {
  if (!loaded) {
    loaded = true
    try {
      const raw = window.localStorage.getItem(KEY)
      const stored = raw === null ? null : (JSON.parse(raw) as { o?: unknown; at?: unknown })
      const age = typeof stored?.at === 'number' ? Date.now() - stored.at : NaN
      // A clock that moved backwards since the offset was learned (age < 0) or a stale offset is dropped; the next pull re-learns it.
      if (typeof stored?.o === 'number' && Number.isFinite(stored.o) && age >= 0 && age <= MAX_STORED_AGE_MS) offsetMs = stored.o
    } catch {
      /* restricted storage */
    }
  }
  return offsetMs
}

function readOffset(): number {
  return learned() ?? 0
}

/**
 * Called with the server's `now()` the moment a pull response arrives; the device clock is only ever compared to the
 * server through this offset. A small change is latency noise and is ignored, so the stamp a push carried converts to
 * the same instant when the row comes back; a real clock change (NTP, manual) moves the offset.
 */
export function noteServerTime(serverIso: string): void {
  const server = Date.parse(serverIso)
  if (Number.isNaN(server)) return
  const next = server - Date.now()
  const current = learned()
  if (current !== null && Math.abs(next - current) <= RELEARN_THRESHOLD_MS) return
  offsetMs = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ o: next, at: Date.now() }))
  } catch {
    /* restricted storage: the offset lives for this session only */
  }
}

/**
 * A stamp written by this device's clock is `toISOString()` (suffix `Z`); stamps that came back from Postgres carry an
 * explicit `+00:00`. Only device stamps need the offset, server stamps are already server time.
 */
export function isDeviceStamp(iso: string): boolean {
  return iso.endsWith('Z')
}

/**
 * The instant of a stamp on the server's clock, or null when it is not a date. A device stamp cannot lie in the
 * server's future (a device clock that ran ahead before the offset was learned): it is held at the server's now.
 */
export function serverInstant(iso: string | undefined): number | null {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) return null
  if (!iso || !isDeviceStamp(iso)) return t
  const offset = readOffset()
  return Math.min(t + offset, Date.now() + offset)
}

/** A device edit stamp as an ISO string on the server's clock (server stamps pass through). */
export function toServerTime(iso: string): string {
  const t = serverInstant(iso)
  return t === null ? iso : new Date(t).toISOString()
}

/** Test seam: behave like a fresh start, reading the offset back from storage. */
export function reloadServerClock(): void {
  offsetMs = null
  loaded = false
}

/** Test seam: forget the learned offset. */
export function resetServerClock(): void {
  offsetMs = null
  loaded = true
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* restricted storage */
  }
}
