import { computeSmsHash } from './ingestGuards'
import type { CanaryResult } from './queueWatch'

/** Every header any shipped app build sends to the SMS endpoint, from the WebView. The preflight must allow all of them. */
export const CANARY_PREFLIGHT_HEADERS = ['authorization', 'content-type', 'x-buddget-device-id', 'x-sms-event-id']

const ORIGIN = 'capacitor://localhost'
const TIMEOUT_MS = 10_000
// A one-time-code text: the server's pre-filter rejects it before any AI or ledger work, so the probe creates no transaction.
const PROBE_MESSAGE = 'Buddget canary: your verification code is 000000. Do not share it.'

export interface CanaryDeps {
  base: string
  fetchImpl?: typeof fetch
  /** Ingest token of a dedicated canary account; without it the end-to-end check is skipped. */
  token?: string
  /** True when the server wrote the claim row for this hash; deletes it when it did. */
  consumeRow?: (smsHash: string) => Promise<boolean>
  now?: () => number
}

type Check = CanaryResult['checks'][number]

async function check(name: string, run: () => Promise<string>): Promise<Check> {
  try {
    return { name, ok: true, detail: await run() }
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Exercises the real client-to-server path the phones use: the CORS preflight a WebView sends, the auth gate, and (when a
 * canary account is configured) a full ingest that must land a row. The incident this exists for broke the first hop
 * silently for weeks: the server saw nothing, so only a probe from outside can notice.
 */
export async function runCanary(deps: CanaryDeps): Promise<CanaryResult> {
  const f = deps.fetchImpl ?? fetch
  const url = `${deps.base.replace(/\/+$/, '')}/api/sms/parse`
  const signal = () => AbortSignal.timeout(TIMEOUT_MS)
  const checks: Check[] = []

  checks.push(await check('cors_preflight', async () => {
    const res = await f(url, { method: 'OPTIONS', signal: signal(), headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': CANARY_PREFLIGHT_HEADERS.join(',') } })
    if (res.status < 200 || res.status >= 300) throw new Error(`preflight answered ${res.status}`)
    const allowed = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase().split(',').map((h) => h.trim())
    const missing = CANARY_PREFLIGHT_HEADERS.filter((h) => !allowed.includes(h))
    if (missing.length > 0) throw new Error(`not allowed: ${missing.join(', ')}`)
    return 'all drain headers allowed'
  }))

  checks.push(await check('auth_gate', async () => {
    const res = await f(url, { method: 'POST', signal: signal(), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer canary-invalid-token', Origin: ORIGIN, 'X-App-Platform': 'web' }, body: JSON.stringify({ message: PROBE_MESSAGE }) })
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
    return 'route reachable, bad token refused'
  }))

  if (deps.token && deps.consumeRow) {
    const consume = deps.consumeRow
    const token = deps.token
    checks.push(await check('end_to_end', async () => {
      const eventId = crypto.randomUUID()
      const receivedAt = new Date((deps.now ?? Date.now)()).toISOString()
      const res = await f(url, { method: 'POST', signal: signal(), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-App-Platform': 'web' }, body: JSON.stringify({ message: PROBE_MESSAGE, sender: 'CANARY', source: 'sms', receivedAt, eventId }) })
      if (!res.ok) throw new Error(`ingest answered ${res.status}`)
      if (!(await consume(computeSmsHash(PROBE_MESSAGE, receivedAt, eventId)))) throw new Error('accepted, but no row was written')
      return 'ingest accepted and recorded'
    }))
  }

  return { at: new Date((deps.now ?? Date.now)()).toISOString(), ok: checks.every((c) => c.ok), checks }
}
