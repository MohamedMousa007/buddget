// QA Session 06 (API & DB) shared helpers. Synthetic users only (qa-api-<n>@buddget-qa.test).
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local; never prints them, tokens or emails.
import { readFileSync } from 'node:fs'

export const BASE = process.env.QA_BASE ?? 'http://localhost:3100'
const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
export const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
export const SB_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const PW = readFileSync(process.env.QA_PW_FILE, 'utf8').trim()

export const USERS = {
  A: { id: 'aaaa0606-0000-4000-8000-000000000001', email: 'qa-api-1@buddget-qa.test' },
  B: { id: 'aaaa0606-0000-4000-8000-000000000002', email: 'qa-api-2@buddget-qa.test' },
  C: { id: 'aaaa0606-0000-4000-8000-000000000003', email: 'qa-api-3@buddget-qa.test' },
}

export async function signIn(who) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS[who].email, password: PW }),
  })
  const j = await r.json().catch(() => ({}))
  if (!j.access_token) throw new Error(`signin ${who} failed ${r.status} ${j.error_code ?? ''}`)
  return j
}

/** Same header and payload, last signature byte flipped: structurally a JWT, never verifies. */
export function tamper(jwt) {
  const [h, p, s] = jwt.split('.')
  return `${h}.${p}.${s.slice(0, -2)}${s.endsWith('AA') ? 'BB' : 'AA'}`
}
/** Payload rewritten to another user's sub with the original signature: must never verify. */
export function forgeSub(jwt, sub) {
  const [h, p, s] = jwt.split('.')
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
  claims.sub = sub
  return `${h}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${s}`
}

// S8C-08: UUIDs too (SMS ingest tokens are UUIDs).
const REDACT = [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, /[\w.+-]+@[\w-]+\.[\w.]+/g, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, /\b[0-9a-f]{32,}\b/gi]
export function redact(s) {
  let out = String(s)
  for (const re of REDACT) out = out.replace(re, '<redacted>')
  return out
}

export async function call(name, { method = 'GET', path, token, body, raw, headers = {} }) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  let payload
  if (raw !== undefined) { payload = raw; h['Content-Type'] ??= 'application/json' }
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] ??= 'application/json' }
  const t0 = performance.now()
  let status, text, ctype
  try {
    const r = await fetch(`${BASE}${path}`, { method, headers: h, body: payload, redirect: 'manual' })
    status = r.status; ctype = r.headers.get('content-type') ?? ''; text = await r.text()
  } catch (e) { status = 'ERR'; text = String(e?.cause?.code ?? e?.message ?? e); ctype = '' }
  const ms = Math.round(performance.now() - t0)
  const isJson = ctype.includes('json')
  const line = `${String(status).padEnd(4)} ${String(ms).padStart(5)}ms ${name.padEnd(48)} ${isJson ? '' : `[${ctype.split(';')[0] || 'no-ctype'}] `}${redact(text).replace(/\s+/g, ' ').slice(0, 170)}`
  console.log(line)
  return { status, text, ms, json: isJson ? safeJson(text) : null }
}
function safeJson(t) { try { return JSON.parse(t) } catch { return null } }
