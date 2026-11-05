const KEY = 'bdg-server-clock-offset-v1'

/** Server time minus device time, in ms, as of the last pull. */
let offsetMs: number | null = null

function readOffset(): number {
  if (offsetMs !== null) return offsetMs
  try {
    const v = Number(window.localStorage.getItem(KEY))
    offsetMs = Number.isFinite(v) ? v : 0
  } catch {
    offsetMs = 0
  }
  return offsetMs
}

/** Called with the server's `now()` the moment a pull response arrives; the device clock is only ever compared to the server through this offset. */
export function noteServerTime(serverIso: string): void {
  const server = Date.parse(serverIso)
  if (Number.isNaN(server)) return
  offsetMs = server - Date.now()
  try {
    window.localStorage.setItem(KEY, String(offsetMs))
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

/** The instant of a stamp on the server's clock, or null when it is not a date. */
export function serverInstant(iso: string | undefined): number | null {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) return null
  return iso && isDeviceStamp(iso) ? t + readOffset() : t
}

/** A device edit stamp as an ISO string on the server's clock (server stamps pass through). */
export function toServerTime(iso: string): string {
  const t = serverInstant(iso)
  return t === null ? iso : new Date(t).toISOString()
}

/** Test seam: forget the learned offset. */
export function resetServerClock(): void {
  offsetMs = null
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* restricted storage */
  }
}
