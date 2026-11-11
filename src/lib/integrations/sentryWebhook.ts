import { createHmac, timingSafeEqual } from 'node:crypto'

export function validSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(raw).digest()
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const MAX_HOOK_AGE_MS = 5 * 60_000

const MAX_UNSTAMPED_EVENT_AGE_MS = 60 * 60_000

/**
 * Sentry stamps each delivery in unix seconds; a replayed old delivery is dropped. Without a stamp the HMAC (which
 * covers the body only) cannot date the delivery, so the event's own datetime, inside the signed body, must be recent.
 */
export function freshHook(stamp: string | null, now: number, eventTime: string | null = null): boolean {
  if (stamp === null) {
    const at = eventTime ? Date.parse(eventTime) : Number.NaN
    return Number.isFinite(at) && Math.abs(now - at) <= MAX_UNSTAMPED_EVENT_AGE_MS
  }
  const ms = Number(stamp) * 1000
  return Number.isFinite(ms) && Math.abs(now - ms) <= MAX_HOOK_AGE_MS
}

export interface CrashEvent {
  fingerprint: string
  release: string
  title: string
  level: 'fatal' | 'error' | 'warning' | 'info'
  culprit: string | null
  stack: string | null
  platform: string | null
  build: string | null
  deviceId: string | null
  userId: string | null
  issueId: string | null
  url: string | null
  seen: string
  eventId: string | null
}

type Frame = { filename?: string; function?: string; lineno?: number; in_app?: boolean }
type SentryEvent = {
  title?: string
  culprit?: string
  level?: string
  platform?: string
  release?: string | { version?: string }
  datetime?: string
  event_id?: string
  issue_id?: string | number
  issue_url?: string
  web_url?: string
  tags?: [string, string][]
  user?: { id?: string }
  exception?: { values?: { type?: string; value?: string; stacktrace?: { frames?: Frame[] } }[] }
}

const LEVELS = new Set(['fatal', 'error', 'warning', 'info'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_STACK = 6000
/** Sentry's own platform names for events that never reached the JS layer, so carry no `platform` tag. */
const NATIVE_PLATFORMS: Record<string, string> = { cocoa: 'ios', java: 'android' }

function stackOf(event: SentryEvent): string | null {
  const values = event.exception?.values
  if (!values?.length) return null
  const lines = values.flatMap((v) => {
    const frames = (v.stacktrace?.frames ?? []).slice(-25).reverse()
    return [`${v.type ?? 'Error'}: ${v.value ?? ''}`.trim(), ...frames.map((f) => `  at ${f.function ?? '?'} (${f.filename ?? '?'}:${f.lineno ?? '?'})`)]
  })
  return lines.join('\n').slice(0, MAX_STACK)
}

/** One Sentry issue-alert delivery as a crash row, or null when it carries no event. Tags carry build and device. */
export function parseCrashEvent(body: unknown): CrashEvent | null {
  const event = (body as { data?: { event?: SentryEvent } } | null)?.data?.event
  if (!event?.title) return null
  const tags = new Map(event.tags ?? [])
  const release = typeof event.release === 'string' ? event.release : (event.release?.version ?? '')
  const issueId = event.issue_id != null ? String(event.issue_id) : null
  const userId = event.user?.id && UUID_RE.test(event.user.id) ? event.user.id : null
  return {
    fingerprint: issueId ?? `${event.title}|${event.culprit ?? ''}`.slice(0, 200),
    release,
    title: event.title.slice(0, 300),
    level: LEVELS.has(event.level ?? '') ? (event.level as CrashEvent['level']) : 'error',
    culprit: event.culprit?.slice(0, 300) ?? null,
    stack: stackOf(event),
    platform: tags.get('platform') ?? (event.platform ? (NATIVE_PLATFORMS[event.platform] ?? event.platform) : null),
    build: tags.get('build') ?? null,
    deviceId: tags.get('device_id') ?? null,
    userId,
    issueId,
    url: event.web_url ?? event.issue_url ?? null,
    eventId: event.event_id ? String(event.event_id).slice(0, 64) : null,
    seen: event.datetime && !Number.isNaN(Date.parse(event.datetime)) ? new Date(event.datetime).toISOString() : new Date().toISOString(),
  }
}
