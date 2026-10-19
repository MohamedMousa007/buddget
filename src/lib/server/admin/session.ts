import type { ServiceClient } from '@/lib/supabase/service'
import { randomToken, sha256Hex } from './crypto'

/** `__Host-` pins the cookie to this exact origin (Secure, Path=/, no Domain), so a sibling subdomain cannot plant one. */
export const ADMIN_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-bdg_admin' : 'bdg_admin'
export const ADMIN_SESSION_HEADER = 'x-admin-session'
export const ADMIN_CSRF_HEADER = 'x-requested-with'
export const ADMIN_CSRF_VALUE = 'buddget-admin'

export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000
/** A biometric unlock rests on a secret stored on the phone, so it is held to a shorter leash than password + code. */
export const BIOMETRIC_SESSION_MS = 4 * 60 * 60 * 1000
export const SESSION_IDLE_MS = 60 * 60 * 1000
const TOUCH_EVERY_MS = 60 * 1000

export type SessionMethod = 'password_totp' | 'biometric' | 'recovery'

export interface AdminSessionRow {
  id: string
  user_id: string
  method: SessionMethod
  created_at: string
  last_seen_at: string
  expires_at: string
  ip: string | null
  user_agent: string | null
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get(ADMIN_SESSION_HEADER)?.trim()
  if (header) return header
  const cookie = req.headers.get('cookie') ?? ''
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === ADMIN_COOKIE) return rest.join('=') || null
  }
  return null
}

export async function createAdminSession(
  service: ServiceClient,
  input: { userId: string; method: SessionMethod; ip: string; userAgent: string | null },
): Promise<{ token: string; expiresAt: string; id: string }> {
  const token = randomToken()
  const lifetime = input.method === 'biometric' ? BIOMETRIC_SESSION_MS : SESSION_ABSOLUTE_MS
  const expiresAt = new Date(Date.now() + lifetime).toISOString()
  const { data, error } = await service
    .from('admin_sessions')
    .insert({
      user_id: input.userId,
      token_hash: sha256Hex(token),
      method: input.method,
      ip: input.ip,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Could not create admin session: ${error?.message}`)
  return { token, expiresAt, id: data.id }
}

/** A session is valid while unrevoked, before its absolute expiry, and recently used. */
export async function validateAdminSession(
  service: ServiceClient,
  token: string,
  userId: string,
): Promise<AdminSessionRow | null> {
  const { data } = await service
    .from('admin_sessions')
    .select('id, user_id, method, created_at, last_seen_at, expires_at, ip, user_agent, revoked_at')
    .eq('token_hash', sha256Hex(token))
    .maybeSingle()
  if (!data || data.user_id !== userId || data.revoked_at) return null
  const now = Date.now()
  if (new Date(data.expires_at).getTime() <= now) return null
  const lastSeen = new Date(data.last_seen_at).getTime()
  if (now - lastSeen > SESSION_IDLE_MS) return null
  if (now - lastSeen > TOUCH_EVERY_MS) {
    await service.from('admin_sessions').update({ last_seen_at: new Date(now).toISOString() }).eq('id', data.id)
  }
  return data as AdminSessionRow
}

export async function revokeAdminSession(service: ServiceClient, id: string): Promise<void> {
  await service.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null)
}

export async function revokeAllAdminSessions(service: ServiceClient, userId: string, exceptId?: string): Promise<void> {
  let q = service.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).is('revoked_at', null)
  if (exceptId) q = q.neq('id', exceptId)
  await q
}

export function sessionCookie(token: string, expiresAt: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${secure}`
}

export function clearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
}
