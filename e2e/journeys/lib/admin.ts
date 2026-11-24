/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import { env } from './env'

/**
 * Service-role helpers for SYNTHETIC users only (qa-e2e-*@buddget-qa.test).
 * Every call that touches user data asserts the email domain first.
 */
const URL_ = () => env('NEXT_PUBLIC_SUPABASE_URL')
const KEY = () => env('SUPABASE_SECRET_KEY')
const headers = () => ({ apikey: KEY(), Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' })

export const QA_DOMAIN = '@buddget-qa.test'
export const PASSWORD = 'Qa-E2e-Journey-2026!x'

function guard(email: string) {
  if (!email.endsWith(QA_DOMAIN) || !email.startsWith('qa-e2e-')) throw new Error(`refusing non-synthetic email ${email}`)
}

export function qaEmail(tag: string): string {
  return `qa-e2e-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${QA_DOMAIN}`
}

async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_()}${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } })
  const text = await r.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* keep text */ }
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  return body as any
}

/** Creates a confirmed synthetic user without sending any email. */
export async function createConfirmedUser(email: string, password = PASSWORD): Promise<string> {
  guard(email)
  const u = await call('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })
  return u.id as string
}

export async function findUserId(email: string): Promise<string | null> {
  guard(email)
  for (let page = 1; page < 50; page++) {
    const r = await call(`/auth/v1/admin/users?page=${page}&per_page=200`)
    const users = (r.users ?? []) as { id: string; email: string }[]
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit.id
    if (users.length < 200) return null
  }
  return null
}

/**
 * New sign-up confirmation code for an unconfirmed user. GoTrue keeps only a hash of the emailed code,
 * so the test asks GoTrue for a fresh code (no email sent) and types that into the app's verify step.
 */
export async function signupOtp(email: string, password = PASSWORD): Promise<string> {
  guard(email)
  const r = await call('/auth/v1/admin/generate_link', { method: 'POST', body: JSON.stringify({ type: 'signup', email, password }) })
  const otp = r.email_otp ?? r.properties?.email_otp
  if (!otp) throw new Error('generate_link returned no email_otp')
  return String(otp)
}

/** PostgREST read as service role, always filtered to one synthetic user id. */
export async function rows<T = any>(table: string, userId: string, query = ''): Promise<T[]> {
  const col = table === 'profiles' ? 'id' : 'user_id'
  return call(`/rest/v1/${table}?${col}=eq.${userId}${query ? `&${query}` : ''}`) as Promise<T[]>
}

/** Service-role insert of seed rows for one synthetic user (the fixture's own user id), returning the inserted rows. */
export async function insertRows<T = any>(table: string, userId: string, data: Record<string, unknown>[]): Promise<T[]> {
  return call(`/rest/v1/${table}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data.map((r) => ({ ...r, user_id: userId }))) }) as Promise<T[]>
}

/** Deletes a synthetic user (rows cascade from auth.users). */
export async function deleteUser(email: string): Promise<void> {
  guard(email)
  const id = await findUserId(email)
  if (id) await call(`/auth/v1/admin/users/${id}`, { method: 'DELETE' })
}

/** Marks a synthetic user's email confirmed (used when the app's own code step cannot be completed, see E2E-001). */
export async function confirmUser(email: string): Promise<string> {
  guard(email)
  const id = await findUserId(email)
  if (!id) throw new Error(`no user ${email}`)
  await call(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ email_confirm: true }) })
  return id
}
