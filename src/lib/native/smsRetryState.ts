/**
 * Per-message retry schedule for the in-app SMS drain. Keyed by the message's eventId (never the text), kept in
 * localStorage, and pruned to whatever is still queued. A queued SMS is only ever removed by a server acknowledgement;
 * this only decides WHEN to try it again, so a message the server keeps refusing is parked on a slow schedule, not lost.
 */
export interface RetryEntry {
  attempts: number
  /** Epoch ms before which the automatic drain leaves this message alone. */
  nextAt: number
  /** Short failure class shown to staff: `http_403`, `network`, `claim_in_progress`. */
  lastError: string
}

export type RetryState = Record<string, RetryEntry>

const KEY = 'buddget_sms_retry'
const MIN_MS = 60_000
const TRANSIENT_CAP_MS = 60 * 60_000
const POISON_CAP_MS = 6 * 60 * 60_000
const MAX_RETRY_AFTER_MS = 6 * 60 * 60_000

/**
 * Full-jitter exponential backoff: 1 min, 2, 4, ... capped at 1 h (6 h for a message the server answered 400/422, which
 * a retry will not fix until the server changes). A server `Retry-After` wins when it asks for longer. Jitter keeps a
 * fleet of phones that all failed at the same moment from retrying at the same moment.
 */
export function nextDelayMs(attempts: number, opts: { poison?: boolean; retryAfterMs?: number; random?: () => number } = {}): number {
  const cap = opts.poison ? POISON_CAP_MS : TRANSIENT_CAP_MS
  const ceiling = Math.min(cap, MIN_MS * 2 ** Math.max(0, attempts - 1))
  const jittered = Math.round(ceiling * (0.5 + (opts.random ?? Math.random)() / 2))
  const asked = Math.min(MAX_RETRY_AFTER_MS, Math.max(0, opts.retryAfterMs ?? 0))
  return Math.max(jittered, asked)
}

/** `Retry-After` as milliseconds: delta-seconds or an HTTP date; 0 when absent or unreadable. */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (!header) return 0
  const secs = Number(header)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(header)
  return Number.isNaN(at) ? 0 : Math.max(0, at - now)
}

export function loadRetryState(): RetryState {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as RetryState) : {}
  } catch {
    return {}
  }
}

/** Keeps only entries whose message is still queued, so the record never outlives its SMS. */
export function saveRetryState(state: RetryState, queuedKeys: Set<string>): void {
  const kept: RetryState = {}
  for (const k of Object.keys(state)) if (queuedKeys.has(k)) kept[k] = state[k]!
  try {
    localStorage.setItem(KEY, JSON.stringify(kept))
  } catch {
    /* storage unavailable: the next drain simply retries sooner */
  }
}

export function isDue(entry: RetryEntry | undefined, now = Date.now()): boolean {
  return !entry || entry.nextAt <= now
}
