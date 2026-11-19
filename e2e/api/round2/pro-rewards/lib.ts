/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped PostgREST JSON */
// S8g (QA round 2): Pro, Rewards, Invite and Founders. Synthetic users only (qa-e2e-pr-*@buddget-qa.test), created and
// deleted here. Never logs tokens, keys, emails or UUIDs: everything printed goes through mask().
import { createHmac, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...(process.env as Record<string, string>) }
  for (const f of [resolve(__dirname, '../../../../.env.local'), process.env.QA_ENV_FILE].filter(Boolean) as string[]) {
    if (!existsSync(f)) continue
    for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l)
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  }
  return out
}
export const ENV = loadEnv()
export const SB_URL = ENV.NEXT_PUBLIC_SUPABASE_URL
export const SB_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE = ENV.SUPABASE_SECRET_KEY
export const PW = ENV.QA_PW
export const BASE = process.env.QA_BASE ?? 'http://localhost:3100'
if (!SB_URL?.includes('tzioppxwsljhlglyducm')) throw new Error('not the Frankfurt project')

export const QA_PREFIX = 'qa-e2e-pr-'
const DOMAIN = '@buddget-qa.test'
const REGISTRY = process.env.QA_REGISTRY ?? resolve(__dirname, 'test-results/users.log')

/** Masks JWTs, UUIDs, emails, long hex and the configured secrets. */
export function mask(s: unknown): string {
  let t = typeof s === 'string' ? s : JSON.stringify(s)
  for (const v of [SERVICE, SB_KEY, PW, ENV.CRON_SECRET, ENV.REVENUECAT_WEBHOOK_AUTH, ENV.REVENUECAT_WEBHOOK_HMAC_SECRET]) if (v) t = t.split(v).join('<secret>')
  return t
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
    .replace(/\b[0-9a-f]{32,}\b/gi, '<hex>')
    .slice(0, 600)
}

export type Res = { status: number; json: any; text: string; headers: Headers }
async function wrap(r: Response): Promise<Res> {
  const text = await r.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: r.status, json, text, headers: r.headers }
}
const svcHeaders = (extra: Record<string, string> = {}) => ({ apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...extra })

/** Service-role PostgREST. Callers always filter by a synthetic user id. */
export async function svc(path: string, init: RequestInit = {}): Promise<Res> {
  return wrap(await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: svcHeaders({ Prefer: 'return=representation', ...(init.headers as Record<string, string>) }) }))
}
export const svcRpc = (fn: string, body: unknown = {}) => svc(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) })
export async function svcSql<T = any>(fn: string, body: unknown = {}): Promise<T> {
  const r = await svcRpc(fn, body)
  if (r.status >= 300) throw new Error(`${fn} ${r.status} ${mask(r.text)}`)
  return r.json as T
}
/** Upsert of one synthetic user's own row. */
export async function svcUpsert(table: string, row: Record<string, unknown>, onConflict = 'user_id'): Promise<Res> {
  return svc(`${table}?on_conflict=${onConflict}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) })
}
export async function svcPatch(table: string, filter: string, patch: Record<string, unknown>): Promise<Res> {
  if (!/user_id=eq\.|id=eq\./.test(filter)) throw new Error('unscoped patch')
  return svc(`${table}?${filter}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

/** PostgREST as a user token, or anon (publishable key only) when token is null. */
export async function rest(token: string | null, path: string, init: RequestInit = {}): Promise<Res> {
  const headers: Record<string, string> = { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers as Record<string, string>) }
  if (token) headers.Authorization = `Bearer ${token}`
  return wrap(await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers }))
}
export const rpc = (token: string | null, fn: string, body: unknown = {}) => rest(token, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) })

/** The app server on :3100. */
export async function app(path: string, init: RequestInit & { token?: string | null } = {}): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  return wrap(await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' }))
}

export interface QaUser { id: string; email: string; token: string }

/** Creates a confirmed synthetic user and signs in (a fresh session per call). */
export async function makeUser(tag: string): Promise<QaUser> {
  const email = `${QA_PREFIX}${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${DOMAIN}`
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, { method: 'POST', headers: svcHeaders(), body: JSON.stringify({ email, password: PW, email_confirm: true }) })
  const j = (await r.json()) as { id?: string }
  if (!j.id) throw new Error(`create user ${r.status}`)
  try { appendFileSync(REGISTRY, `${j.id} ${email}\n`) } catch { /* registry is a convenience; teardown also sweeps by prefix */ }
  return { id: j.id, email, token: await signIn(email) }
}
export async function signIn(email: string): Promise<string> {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })
  const j = (await r.json().catch(() => ({}))) as { access_token?: string }
  if (!j.access_token) throw new Error(`signin failed ${r.status}`)
  return j.access_token
}

/**
 * Deletes a synthetic user. Rows without a cascade (billing_events, trial_claims, founders, referrals, admin_audit_log as actor,
 * admin_staff) are removed first, by that user's id only.
 */
export async function dropUser(u: Pick<QaUser, 'id' | 'email'>): Promise<void> {
  if (!u.email.startsWith(QA_PREFIX) || !u.email.endsWith(DOMAIN)) throw new Error('refusing non-synthetic user')
  const id = u.id
  await svc(`billing_events?user_id=eq.${id}`, { method: 'DELETE' })
  await svc(`trial_claims?user_id=eq.${id}`, { method: 'DELETE' })
  await svc(`founders?user_id=eq.${id}`, { method: 'DELETE' })
  await svc(`founder_candidates?user_id=eq.${id}`, { method: 'DELETE' })
  await svc(`referrals?inviter_id=eq.${id}`, { method: 'DELETE' })
  await svc(`referrals?invitee_id=eq.${id}`, { method: 'DELETE' })
  await svc(`admin_staff?user_id=eq.${id}`, { method: 'DELETE' })
  await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svcHeaders() })
}

/** The local week start (Saturday default is read from user_settings) as the server computes it. */
export async function weekStarts(token: string): Promise<{ thisWeek: string; lastWeek: string; lastWeekOpen: boolean }> {
  const r = await rpc(token, 'loyalty_week_summary')
  return r.json
}
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Inserts n expenses for the user (as the user) dated `day`. */
export async function addExpenses(u: QaUser, day: string, n: number): Promise<void> {
  const rows = Array.from({ length: n }, (_, i) => ({ id: randomUUID(), user_id: u.id, amount: 10 + i, currency: 'EGP', category: 'Food', description: `qa pr ${i}`, expense_date: day }))
  const r = await rest(u.token, 'expenses', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
  if (r.status >= 300) throw new Error(`expenses ${r.status} ${mask(r.text)}`)
}

/** Sets a user's loyalty facts directly (service role, own row). */
export async function setLoyalty(userId: string, patch: Record<string, unknown>): Promise<void> {
  const r = await svcUpsert('loyalty_accounts', { user_id: userId, ...patch })
  if (r.status >= 300) throw new Error(`loyalty ${r.status} ${mask(r.text)}`)
}
export async function setEntitlement(userId: string, row: Record<string, unknown>): Promise<void> {
  const r = await svcUpsert('user_entitlements', { user_id: userId, ...row })
  if (r.status >= 300) throw new Error(`ent ${r.status} ${mask(r.text)}`)
}
export const PRO_ACTIVE = (days = 30) => ({ plan_key: 'plus', status: 'active', source: 'apple', trial_ends_at: null, current_period_end: new Date(Date.now() + days * 86_400_000).toISOString(), grace_ends_at: null, canceled_at: null, product_id: 'pro_monthly', store: 'app_store' })
export const PRO_LAPSED = () => ({ plan_key: 'plus', status: 'expired', source: 'apple', trial_ends_at: null, current_period_end: new Date(Date.now() - 2 * 86_400_000).toISOString(), grace_ends_at: null, product_id: 'pro_monthly', store: 'app_store' })
export const TRIAL = (days = 30) => ({ plan_key: 'plus_trial', status: 'trialing', source: 'default', trial_ends_at: new Date(Date.now() + days * 86_400_000).toISOString(), current_period_end: null })
export const FREE = () => ({ plan_key: 'free', status: 'active', source: 'default', trial_ends_at: null, current_period_end: null })

export async function account(userId: string): Promise<any> {
  return (await svc(`loyalty_accounts?user_id=eq.${userId}&select=points_balance,lifetime_points,tier_key,gifted_rank,streak_weeks,multiplier_step,freezes_banked,kept_weeks_total,last_kept_week`)).json?.[0] ?? null
}
export async function rewardSparks(userId: string): Promise<Array<{ granted: number; ref: string; period_end: string; period_start: string }>> {
  return (await svc(`spark_allowances?user_id=eq.${userId}&kind=eq.reward&select=granted,used,ref,period_start,period_end&limit=50`)).json ?? []
}

// ---------------------------------------------------------------- RevenueCat webhook (local test secrets only)
export function rcSign(raw: string, at = Date.now()) {
  const t = Math.floor(at / 1000)
  const v1 = createHmac('sha256', ENV.REVENUECAT_WEBHOOK_HMAC_SECRET ?? '').update(`${t}.${raw}`).digest('hex')
  return { authorization: `Bearer ${ENV.REVENUECAT_WEBHOOK_AUTH}`, 'x-revenuecat-webhook-signature': `t=${t},v1=${v1}` }
}
export async function rcPost(event: Record<string, unknown>, opts: { headers?: Record<string, string>; raw?: string } = {}): Promise<Res> {
  const raw = opts.raw ?? JSON.stringify({ api_version: '1.0', event })
  return app('/api/billing/revenuecat', { method: 'POST', body: raw, headers: opts.headers ?? rcSign(raw) })
}
export const hasRcSecrets = () => !!ENV.REVENUECAT_WEBHOOK_AUTH && !!ENV.REVENUECAT_WEBHOOK_HMAC_SECRET

/** A temporary staff row for one synthetic user (role admin), so the audited admin_rewards_* RPCs can be exercised. */
export async function makeStaff(u: QaUser): Promise<void> {
  const r = await svc('admin_staff', { method: 'POST', body: JSON.stringify({ email: u.email, user_id: u.id, role_key: 'admin', status: 'active', display_name: 'QA S8g' }) })
  if (r.status >= 300) throw new Error(`staff ${r.status} ${mask(r.text)}`)
}

/** A founder number in 90..100 not taken (founders.number is 1..100; real accounts hold 1..48). Deleted with the user. */
export async function freeFounderNumber(): Promise<number> {
  const taken = new Set(((await svc('founders?number=gte.90&select=number')).json as Array<{ number: number }>).map((x) => x.number))
  for (let n = 100; n >= 90; n--) if (!taken.has(n)) return n
  throw new Error('no free test founder number')
}
