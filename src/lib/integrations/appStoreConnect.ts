import { createHash, createSign } from 'node:crypto'

const API = 'https://api.appstoreconnect.apple.com'
const JWT_TTL_SECONDS = 15 * 60

export interface AscCredentials {
  issuerId: string
  keyId: string
  privateKey: string
  appId: string
}

export function ascCredentialsFromEnv(env: Record<string, string | undefined> = process.env): AscCredentials | null {
  const { ASC_ISSUER_ID: issuerId, ASC_KEY_ID: keyId, ASC_PRIVATE_KEY: key, ASC_APP_ID: appId } = env
  if (!issuerId || !keyId || !key || !appId) return null
  return { issuerId, keyId, appId, privateKey: key.replace(/\\n/g, '\n') }
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url')

/** App Store Connect API token: ES256, at most 20 minutes of life. */
export function ascToken(c: AscCredentials, now = Date.now()): string {
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId, typ: 'JWT' }))
  const body = b64url(JSON.stringify({ iss: c.issuerId, iat, exp: iat + JWT_TTL_SECONDS, aud: 'appstoreconnect-v1' }))
  const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key: c.privateKey, dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${b64url(sig)}`
}

type Resource = { id: string; type: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id: string; type: string } | null }> }
type Page = { data?: Resource[]; included?: Resource[] }

async function get(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`App Store Connect ${res.status} on ${path.split('?')[0]}`)
  return res.json()
}

export interface IosCrash {
  submissionId: string
  fingerprint: string
  release: string
  build: string | null
  title: string
  culprit: string | null
  stack: string
  email: string | null
  seen: string
}

const SYSTEM_IMAGES = /^(libsystem|libobjc|libc\+\+|libdispatch|libdyld|dyld|CoreFoundation|libswift|Foundation$)/
const str = (v: unknown) => (typeof v === 'string' ? v : null)

/** One Apple crash report as a crash row. The cause is the first frame of the crashed thread outside the C runtime, e.g. UIKitCore's scene check. */
export function parseCrashLog(logText: string): { title: string; culprit: string | null; stack: string; fingerprint: string } {
  const exception = /^Exception Type:\s*(.+)$/m.exec(logText)?.[1]?.trim() ?? 'Unknown exception'
  const reason = /^Termination Reason:\s*(.+)$/m.exec(logText)?.[1]?.trim()
  const crashed = /^Thread \d+ Crashed:?\s*\n((?:\d+\s+.+\n?)+)/m.exec(logText)?.[1] ?? ''
  const frames = crashed.split('\n').map((l) => /^\d+\s+(\S+)\s+0x[0-9a-f]+\s+(.+)$/i.exec(l.trim())).filter((m): m is RegExpExecArray => !!m).map((m) => ({ image: m[1], symbol: m[2].replace(/\s+\+\s+\d+$/, '') }))
  const top = frames.find((f) => !SYSTEM_IMAGES.test(f.image)) ?? frames[0]
  const culprit = top ? `${top.image}: ${top.symbol}`.slice(0, 300) : null
  const title = `iOS crash: ${exception}${culprit ? ` in ${culprit}` : reason ? ` (${reason})` : ''}`.slice(0, 300)
  const stack = (crashed || logText).split('\n').slice(0, 40).join('\n').slice(0, 6000)
  const fingerprint = `asc:${createHash('sha1').update(`${exception}|${culprit ?? reason ?? ''}`).digest('hex').slice(0, 16)}`
  return { title, culprit, stack, fingerprint }
}

/** Crashes TestFlight testers have shared since `since`, with Apple's own crash log. Covers crashes before any SDK can start. */
export async function fetchIosCrashes(c: AscCredentials, since: Date, limit = 50): Promise<IosCrash[]> {
  const token = ascToken(c)
  const page = (await get(`/v1/apps/${c.appId}/betaFeedbackCrashSubmissions?limit=${limit}&sort=-createdDate&include=build&fields[builds]=version&fields[betaFeedbackCrashSubmissions]=createdDate,email,build`, token)) as Page
  const builds = new Map((page.included ?? []).filter((r) => r.type === 'builds').map((r) => [r.id, str(r.attributes?.version)]))
  const out: IosCrash[] = []
  for (const sub of page.data ?? []) {
    const seen = str(sub.attributes?.createdDate)
    if (!seen || new Date(seen) < since) continue
    const log = (await get(`/v1/betaFeedbackCrashSubmissions/${sub.id}/crashLog`, token)) as { data?: Resource }
    const text = str(log.data?.attributes?.logText)
    if (!text) continue
    const buildId = sub.relationships?.build?.data?.id
    const build = (buildId && builds.get(buildId)) || null
    out.push({ submissionId: sub.id, release: `buddget@${/Version:\s*([\d.]+)/.exec(text)?.[1] ?? 'ios'}`, build, email: str(sub.attributes?.email), seen, ...parseCrashLog(text) })
  }
  return out
}
