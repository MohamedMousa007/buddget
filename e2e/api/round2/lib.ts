// S8c round 2 helpers: synthetic users qa-api-1..3 only (created by setup.mjs). Never logs tokens, keys or emails.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = Object.fromEntries(
  readFileSync(resolve(__dirname, '../../../.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
export const SB_URL = envFile.NEXT_PUBLIC_SUPABASE_URL as string
export const SB_KEY = envFile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
const SERVICE_KEY = envFile.SUPABASE_SECRET_KEY as string
const PW = readFileSync(process.env.QA_PW_FILE as string, 'utf8').trim()

export const USERS = {
  A: { id: 'aaaa0606-0000-4000-8000-000000000001', email: 'qa-api-1@buddget-qa.test' },
  B: { id: 'aaaa0606-0000-4000-8000-000000000002', email: 'qa-api-2@buddget-qa.test' },
  C: { id: 'aaaa0606-0000-4000-8000-000000000003', email: 'qa-api-3@buddget-qa.test' },
} as const
export type Who = keyof typeof USERS

/** B's seed rows from setup.mjs. */
export const B_ROWS = {
  notification: 'bbbb0606-0000-4000-8000-0000000000a1',
  device: 'bbbb0606-0000-4000-8000-0000000000d1',
  pm: 'bbbb0606-0000-4000-8000-0000000000b1',
  pocket: 'bbbb0606-0000-4000-8000-0000000000b2',
  debt: 'bbbb0606-0000-4000-8000-0000000000b3',
  expense: 'bbbb0606-0000-4000-8000-0000000000b4',
  smsLog: 'bbbb0606-0000-4000-8000-0000000000b5',
}

/** A fresh password session (a new auth.sessions row each call). */
export async function signIn(who: Who): Promise<string> {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS[who].email, password: PW }),
  })
  const j = (await r.json().catch(() => ({}))) as { access_token?: string }
  if (!j.access_token) throw new Error(`signin ${who} failed ${r.status}`)
  return j.access_token
}

export type Res = { status: number; json: unknown; text: string; headers: Headers }
async function wrap(r: Response): Promise<Res> {
  const text = await r.text()
  let json: unknown = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: r.status, json, text, headers: r.headers }
}

/** PostgREST as a user token (or the publishable key alone when token is null). */
export async function rest(token: string | null, path: string, init: RequestInit = {}): Promise<Res> {
  const headers: Record<string, string> = { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers as Record<string, string>) }
  if (token) headers.Authorization = `Bearer ${token}`
  return wrap(await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers }))
}
export const rpc = (token: string | null, fn: string, body: unknown) => rest(token, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) })

/** Service-role read for assertions only (bounded by the caller with a filter and limit). */
export async function serviceGet(path: string): Promise<Res> {
  return wrap(await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }))
}

export function code(r: Res): string | undefined {
  return (r.json as { code?: string } | null)?.code
}

/** Service-role delete of one synthetic row by a filter the caller scopes to a synthetic user. */
export async function serviceDelete(path: string): Promise<number> {
  return (await fetch(`${SB_URL}/rest/v1/${path}`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })).status
}
