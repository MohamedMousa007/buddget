import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { can, canAny, type Permission } from '@/lib/admin/permissions'
import { resolveRouteIdentity, resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import { writeAudit } from './audit'
import { loadCredentials } from './credentials'
import {
  ADMIN_CSRF_HEADER,
  ADMIN_CSRF_VALUE,
  readSessionToken,
  validateAdminSession,
  type AdminSessionRow,
} from './session'
import { resolveSsoSession } from './sso'
import { resolveStaff, type StaffContext } from './staff'

export interface AdminContext extends StaffContext {
  user: User
  service: ServiceClient
  session: AdminSessionRow | null
  ip: string
  userAgent: string | null
  audit: (action: string, detail?: { targetType?: string; targetId?: string; summary?: string; metadata?: Record<string, unknown> }) => Promise<void>
  /** True when the actor may see unmasked email / phone. */
  canSeePii: boolean
}

export type GuardResult = { ok: true; ctx: AdminContext } | { ok: false; res: NextResponse }

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown'
}

function deny(status: number, error: string, code: string): GuardResult {
  return { ok: false, res: NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } }) }
}

interface GuardOptions {
  /** Needs any one of these. Omit for "any active staff". */
  permission?: Permission | readonly Permission[]
  /** Skip the unlocked-session requirement (setup and login endpoints). Default: session required. */
  sessionOptional?: boolean
}

/**
 * Every admin endpoint goes through here. Layers, in order: signed-in account, active staff record,
 * CSRF header on mutations, an unlocked admin session (own token, or the app sign-in when the person's SSO switch is on), then the permission.
 */
/**
 * Reads are the portal's bulk traffic. The caller's identity is verified locally from the JWT, and the staff record,
 * role and credentials are remembered for a few seconds, so a screen costs one cheap check instead of five round
 * trips. Every write skips this: it asks the Auth server (so a revoked session stops at once) and reads staff,
 * role and credentials fresh, so a suspension or role change is never one request late for a destructive action.
 */
const STAFF_CACHE_MS = 5_000
interface CachedStaff {
  at: number
  user: User
  staffCtx: StaffContext
  cred: Awaited<ReturnType<typeof loadCredentials>>
}
const staffCache = new Map<string, CachedStaff>()

export async function guardAdmin(req: Request, opts: GuardOptions = {}): Promise<GuardResult> {
  const readOnly = req.method === 'GET' || req.method === 'HEAD'
  if (!readOnly) staffCache.clear()

  let hit: CachedStaff | undefined
  if (readOnly) {
    const identity = await resolveRouteIdentity(req)
    if (!identity) return deny(401, 'Sign in to continue.', 'unauthenticated')
    const cached = staffCache.get(identity.id)
    if (cached && Date.now() - cached.at < STAFF_CACHE_MS) hit = cached
  }

  const service = createServiceRoleClient()
  let user: User
  let staffCtx: StaffContext
  let cred: CachedStaff['cred']
  if (hit) {
    ;({ user, staffCtx, cred } = hit)
  } else {
    const resolved = await resolveRouteUser(req)
    if (!resolved.user) return deny(401, 'Sign in to continue.', 'unauthenticated')
    user = resolved.user
    const found = await resolveStaff(service, user)
    if (!found) return deny(403, 'Not authorized.', 'not_staff')
    if (found.staff.status !== 'active') return deny(403, 'This staff account is suspended.', 'suspended')
    staffCtx = found
    cred = await loadCredentials(service, user.id)
    if (readOnly) staffCache.set(user.id, { at: Date.now(), user, staffCtx, cred })
  }

  if (!readOnly && req.headers.get(ADMIN_CSRF_HEADER) !== ADMIN_CSRF_VALUE) {
    return deny(403, 'Missing request header.', 'csrf')
  }

  // Resolved even when optional, so endpoints like logout can act on the session that was presented.
  const token = readSessionToken(req)
  let session = token ? await validateAdminSession(service, token, user.id) : null
  const ip = clientIp(req)
  const userAgent = req.headers.get('user-agent')
  session ??= await resolveSsoSession(service, user, staffCtx, { ip, userAgent }, cred)
  if (!session && !opts.sessionOptional) return deny(401, 'Admin session locked. Unlock the portal to continue.', 'locked')

  const needed = opts.permission ? (Array.isArray(opts.permission) ? opts.permission : [opts.permission]) as readonly Permission[] : []
  if (needed.length > 0 && !canAny(staffCtx.permissions, needed)) {
    return deny(403, 'Your role does not allow this.', 'forbidden')
  }

  return {
    ok: true,
    ctx: {
      ...staffCtx,
      user,
      service,
      session,
      ip,
      userAgent,
      canSeePii: can(staffCtx.permissions, 'users.pii'),
      audit: (action, detail = {}) =>
        writeAudit(service, {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action,
          targetType: detail.targetType,
          targetId: detail.targetId,
          summary: detail.summary,
          metadata: detail.metadata,
          ip,
        }),
    },
  }
}

export const noStore = { 'Cache-Control': 'no-store' } as const

export function json(body: unknown, init?: number | ResponseInit): NextResponse {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : (init ?? {})
  return NextResponse.json(body, { ...base, headers: { ...noStore, ...(base.headers ?? {}) } })
}

export function bad(message: string, status = 400): NextResponse {
  return json({ error: message }, status)
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

/** Masks an email for staff without `users.pii`: `jo***@gm***.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const [local, domain = ''] = email.split('@')
  const [host = '', ...tld] = domain.split('.')
  return `${local!.slice(0, 2)}***@${host.slice(0, 2)}***${tld.length ? '.' + tld.join('.') : ''}`
}

export function maskIf(ctx: Pick<AdminContext, 'canSeePii'>, email: string | null | undefined): string | null {
  return ctx.canSeePii ? (email ?? null) : maskEmail(email)
}
