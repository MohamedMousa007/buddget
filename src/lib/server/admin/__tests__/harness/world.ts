import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'
import { adminPool } from './pgSupabase'
import { hashPassword } from '../../crypto'
import { issueCode, resetOtp } from './mocks'

export const STAFF_PASSWORD = 'Test-Passw0rd-123'

const DATA_TABLES = [
  'admin_audit_log', 'admin_biometric_devices', 'admin_sessions', 'admin_credentials', 'admin_user_notes',
  'support_ticket_messages', 'support_tickets', 'loyalty_ledger', 'loyalty_accounts', 'loyalty_tiers',
  'user_entitlements', 'feature_flags', 'platform_settings', 'api_rate_limits', 'app_analytics_events',
  'sms_parse_log', 'sms_ingest_tokens', 'push_tokens', 'trusted_devices', 'biometric_devices', 'notifications',
  'expenses', 'income_sources', 'budget_plans', 'debts', 'subscriptions', 'goals', 'savings_accounts', 'receipts',
  'user_settings', 'profiles', 'sms_tracking_templates_ai', 'sms_keyword_pool', 'sms_sender_pool', 'sms_promotion_config',
]

/** Wipes everything the tests create, keeping seeded roles and the default plan. */
export async function resetWorld(): Promise<void> {
  resetOtp()
  const db = adminPool()
  // TRUNCATE skips row triggers, so the owner row can be cleared and re-created per test file.
  await db.query(`truncate admin_staff, plans, auth.users, ${DATA_TABLES.join(', ')} restart identity cascade`)
  await db.query(`insert into plans (key, name, status, is_default, price_monthly_cents, price_yearly_cents, limits, sort_order)
    values ('free','Free','active',true,0,0,'{"ai_budget_per_hour": 15}',0)`)
}

export async function resetRateLimits(): Promise<void> {
  await adminPool().query(`truncate api_rate_limits`)
}

export interface TestUser { id: string; email: string }

export async function makeUser(email: string, opts: { confirmed?: boolean; provider?: string; name?: string } = {}): Promise<TestUser> {
  const id = randomUUID()
  const db = adminPool()
  await db.query(`insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values ($1, $2, ${opts.confirmed === false ? 'null' : 'now()'}, now())`, [id, email])
  await db.query(`insert into auth.identities (user_id, provider) values ($1, $2)`, [id, opts.provider ?? 'email'])
  await db.query(`insert into profiles (id, name, email) values ($1, $2, $3)`, [id, opts.name ?? '', email])
  await db.query(`insert into user_settings (user_id) values ($1)`, [id])
  return { id, email }
}

export interface Staff extends TestUser { staffId: string }

/**
 * A fully set-up staff member (admin password + completed email-code setup) holding `roleKey`.
 * SSO is off by default so tests exercise the unlock paths; pass `sso: true` for the app-session behaviour.
 */
export async function makeStaff(email: string, roleKey: string, opts: { extra?: string[]; name?: string; confirmed?: boolean; sso?: boolean } = {}): Promise<Staff> {
  const user = await makeUser(email, { confirmed: opts.confirmed, name: opts.name })
  const db = adminPool()
  const staff = await db.query(`insert into admin_staff (email, user_id, display_name, role_key, extra_permissions) values ($1,$2,$3,$4,$5) returning id`, [email.toLowerCase(), user.id, opts.name ?? email, roleKey, opts.extra ?? []])
  await db.query(`insert into admin_credentials (user_id, password_hash, setup_completed_at, sso_enabled) values ($1,$2,now(),$3)`, [user.id, await hashPassword(STAFF_PASSWORD), opts.sso ?? false])
  return { ...user, staffId: staff.rows[0].id }
}

/** A freshly "emailed" code for this member (replaces any earlier one, like a real resend). */
export const codeFor = (s: TestUser) => issueCode(s.email)

// Route handlers take either `(req)` or `(req, { params })`; the harness passes params only when a route needs them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler = (req: Request, ctx: any) => Promise<Response>

export interface CallOpts {
  method?: string
  as?: TestUser | null
  token?: string | null
  query?: Record<string, string>
  body?: unknown
  params?: Record<string, string>
  headers?: Record<string, string>
  csrf?: boolean
}
export interface Called { status: number; body: Record<string, any>; headers: Headers } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function call(handler: Handler, opts: CallOpts = {}): Promise<Called> {
  const method = opts.method ?? 'GET'
  const url = new URL('https://buddget.app/api/admin/test')
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
  const headers = new Headers(opts.headers)
  if (opts.as) headers.set('x-test-user', opts.as.id)
  if (opts.token) headers.set('x-admin-session', opts.token)
  if (method !== 'GET' && opts.csrf !== false) headers.set('x-requested-with', 'buddget-admin')
  let body: string | undefined
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers.set('content-type', 'application/json') }
  const res = await handler(new Request(url, { method, headers, body }), opts.params ? { params: Promise.resolve(opts.params) } : undefined)
  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  try { parsed = text ? JSON.parse(text) : {} } catch { parsed = { _raw: text } }
  return { status: res.status, body: parsed, headers: res.headers }
}

/** Unlock the portal the real way: POST /api/admin/auth/login with password + an emailed code. */
export async function unlock(login: Handler, s: Staff): Promise<string> {
  await resetRateLimits()
  const r = await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: codeFor(s) } })
  expect(r.status, JSON.stringify(r.body)).toBe(200)
  return r.body.token as string
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await adminPool().query(sql, params)).rows as T[]
}
