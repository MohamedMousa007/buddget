import type { Breadcrumb, ErrorEvent } from '@sentry/react'

const CURRENCIES = 'EGP|USD|AED|SAR|EUR|GBP|KWD|QAR|BHD|OMR|JOD|XAU|TRY|CAD|CHF|JPY|CNY|INR'
const ARABIC_CURRENCIES = 'جنيه|دولار|ريال|درهم|دينار'

const RULES: readonly (readonly [RegExp, string])[] = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '[token]'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/([?&#](?:apikey|access_token|refresh_token|token|key|code|sig)=)[^&\s"']+/gi, '$1[redacted]'],
  [new RegExp(`\\b\\d[\\d,.\\s]{0,20}\\s?(?:${CURRENCIES}|${ARABIC_CURRENCIES})(?![\\p{L}\\d])`, 'giu'), '[amount]'],
  [new RegExp(`\\b(?:${CURRENCIES})\\s?\\d[\\d,.]{0,20}`, 'giu'), '[amount]'],
  [/\+?\d[\d\s-]{8,24}\d/g, '[number]'],
]

export function scrubText(text: string): string {
  let out = text
  for (const [re, to] of RULES) out = out.replace(re, to)
  return out
}

/** Keys whose values are never useful in a stack and are often the user's own data. */
const SENSITIVE_KEY = /^(authorization|cookie|set-cookie|body|data|amount|balance|email|phone|password|token|text|message_body)$/i

function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubText(value)
  if (depth > 4 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrubValue(v, depth + 1)
  return out
}

type Stacktrace = NonNullable<NonNullable<ErrorEvent['exception']>['values']>[number]['stacktrace']

function scrubStacktrace(st: Stacktrace): Stacktrace {
  if (!st?.frames) return st
  return { ...st, frames: st.frames.map((f) => (f.vars ? { ...f, vars: scrubValue(f.vars) as typeof f.vars } : f)) }
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category === 'console' || b.category === 'ui.input') return null
  return { ...b, message: b.message ? scrubText(b.message) : b.message, data: b.data ? (scrubValue(b.data) as Breadcrumb['data']) : b.data }
}

/** Removes what the user typed or owns before an event leaves the device. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const e = { ...event }
  if (e.message) e.message = scrubText(e.message)
  if (e.exception?.values) {
    e.exception = {
      ...e.exception,
      values: e.exception.values.map((v) => ({ ...v, value: v.value ? scrubText(v.value) : v.value, stacktrace: scrubStacktrace(v.stacktrace) })),
    }
  }
  if (e.threads?.values) {
    e.threads = { ...e.threads, values: e.threads.values.map((t) => ({ ...t, name: t.name ? scrubText(t.name) : t.name, stacktrace: scrubStacktrace(t.stacktrace) })) }
  }
  if (e.request) {
    e.request = { ...e.request, url: e.request.url ? scrubText(e.request.url.split('?')[0] ?? '') : e.request.url, query_string: undefined, cookies: undefined, headers: undefined, data: undefined }
  }
  if (e.user) e.user = { id: e.user.id }
  if (e.extra) e.extra = scrubValue(e.extra) as typeof e.extra
  if (e.contexts) {
    const contexts = scrubValue(e.contexts) as Record<string, Record<string, unknown>>
    if (contexts.device && 'name' in contexts.device) contexts.device = { ...contexts.device, name: '[redacted]' }
    e.contexts = contexts as typeof e.contexts
  }
  if (e.tags) e.tags = scrubValue(e.tags) as typeof e.tags
  if (e.transaction) e.transaction = scrubText(e.transaction)
  delete e.server_name
  if (e.logentry) e.logentry = scrubValue(e.logentry) as typeof e.logentry
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null)
  return e
}
