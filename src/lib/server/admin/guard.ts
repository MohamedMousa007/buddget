import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/server/clientIp'
import type { User } from '@supabase/supabase-js'
import { OWNER_EMAIL, can, canAny, type Permission } from '@/lib/admin/permissions'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import { writeAudit } from './audit'
import { allowAttempt } from './credentials'
import { ADMIN_CSRF_HEADER, ADMIN_CSRF_VALUE, readSessionToken, validateAdminSession, type AdminSessionRow } from './session'
import { resolveStaff, type StaffContext } from './staff'

export interface AdminContext extends StaffContext {
  user: User
  service: ServiceClient
  /** Null only on the sign-in endpoints, which run before a session exists. */
  session: AdminSessionRow | null
  ip: string
  userAgent: string | null
  audit: (action: string, detail?: { targetType?: string; targetId?: string; summary?: string; metadata?: Record<string, unknown> }) => Promise<boolean>
  /** True when the actor may see unmasked email / phone. */
  canSeePii: boolean
}

export type GuardResult = { ok: true; ctx: AdminContext } | { ok: false; res: NextResponse }

export { clientIp }

function deny(status: number, error: string, code: string): GuardResult {
  return { ok: false, res: NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } }) }
}

const LOCKED = () => deny(401, 'Sign in to the admin portal to continue.', 'locked')

interface GuardOptions {
  /** Needs any one of these. Omit for "any active staff". */
  permission?: Permission | readonly Permission[]
}

/**
 * The staff account, role and permissions are remembered for a few seconds on reads, the portal's bulk traffic.
 * Every write reads them fresh, so a suspension or role change is never one request late for a destructive action.
 */
const STAFF_CACHE_MS = 5_000
interface CachedStaff {
  at: number
  user: User
  staffCtx: StaffContext
}
const staffCache = new Map<string, CachedStaff>()

type Loaded = { user: User; staffCtx: StaffContext } | 'not_staff' | 'suspended'

async function loadStaff(service: ServiceClient, userId: string, readOnly: boolean): Promise<Loaded> {
  if (readOnly) {
    const cached = staffCache.get(userId)
    if (cached && Date.now() - cached.at < STAFF_CACHE_MS) return cached
  }
  const { data } = await service.auth.admin.getUserById(userId)
  if (!data?.user) return 'not_staff'
  const staffCtx = await resolveStaff(service, data.user)
  if (!staffCtx) return 'not_staff'
  if (staffCtx.staff.status !== 'active') return 'suspended'
  if (readOnly) staffCache.set(userId, { at: Date.now(), user: data.user, staffCtx })
  return { user: data.user, staffCtx }
}

function contextFor(req: Request, service: ServiceClient, user: User, staffCtx: StaffContext, session: AdminSessionRow | null): AdminContext {
  const ip = clientIp(req)
  return {
    ...staffCtx,
    user,
    service,
    session,
    ip,
    userAgent: req.headers.get('user-agent'),
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
  }
}

/**
 * Every admin endpoint goes through here. The portal has its own sign-in: the caller is whoever the admin session
 * token names, and being signed in to the buddget app counts for nothing. Layers, in order: CSRF header on
 * mutations, a live admin session, an active staff record, then the permission.
 */
export async function guardAdmin(req: Request, opts: GuardOptions = {}): Promise<GuardResult> {
  const readOnly = req.method === 'GET' || req.method === 'HEAD'
  if (!readOnly) staffCache.clear()
  if (!readOnly && req.headers.get(ADMIN_CSRF_HEADER) !== ADMIN_CSRF_VALUE) return deny(403, 'Missing request header.', 'csrf')

  const token = readSessionToken(req)
  if (!token) return LOCKED()
  const service = createServiceRoleClient()
  const session = await validateAdminSession(service, token)
  if (!session) return LOCKED()

  const loaded = await loadStaff(service, session.user_id, readOnly)
  if (loaded === 'not_staff') return deny(403, 'Not authorized.', 'not_staff')
  if (loaded === 'suspended') return deny(403, 'This staff account is suspended.', 'suspended')

  const needed = opts.permission ? (Array.isArray(opts.permission) ? opts.permission : [opts.permission]) as readonly Permission[] : []
  if (needed.length > 0 && !canAny(loaded.staffCtx.permissions, needed)) return deny(403, 'Your role does not allow this.', 'forbidden')

  return { ok: true, ctx: contextFor(req, service, loaded.user, loaded.staffCtx, session) }
}

export const SIGN_IN_ERROR = 'Those details did not match. Check them and try again.'

/**
 * The sign-in endpoints (password step, emailed code, first-time setup, biometric unlock) run before a session exists.
 * They name the staff member by email, or by the account a biometric device was enrolled for. Every failure is the
 * same 401 so an address that is not on the team looks exactly like a wrong password.
 */
export async function guardSignIn(req: Request, who: { email?: unknown; userId?: string | null }): Promise<GuardResult> {
  if (req.headers.get(ADMIN_CSRF_HEADER) !== ADMIN_CSRF_VALUE) return deny(403, 'Missing request header.', 'csrf')
  const service = createServiceRoleClient()
  if (!(await allowAttempt(service, `admin-signin-ip:${clientIp(req)}`, 900, 40))) return deny(429, 'Too many attempts. Try again later.', 'throttled')

  const refused: GuardResult = { ok: false, res: bad(SIGN_IN_ERROR, 401) }
  let userId = who.userId ?? null
  if (!userId) {
    const email = typeof who.email === 'string' ? who.email.trim().toLowerCase() : ''
    if (!email || email.length > 254) return refused
    const { data: row } = await service.from('admin_staff').select('user_id').eq('email', email).maybeSingle()
    userId = row?.user_id ?? null
    // An invited address that has not opened the portal yet, or the owner's first visit: bound to its account by resolveStaff.
    if (!userId && (row || email === OWNER_EMAIL)) userId = (await service.rpc('user_id_by_email', { p_email: email })).data ?? null
  }
  if (!userId) return refused
  const loaded = await loadStaff(service, userId, false)
  if (typeof loaded === 'string') return refused
  return { ok: true, ctx: contextFor(req, service, loaded.user, loaded.staffCtx, null) }
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
