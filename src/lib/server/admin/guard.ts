import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { can, canAny, type Permission } from '@/lib/admin/permissions'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import { writeAudit } from './audit'
import {
  ADMIN_CSRF_HEADER,
  ADMIN_CSRF_VALUE,
  readSessionToken,
  validateAdminSession,
  type AdminSessionRow,
} from './session'
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
 * CSRF header on mutations, an unlocked admin session bound to the same account, then the permission.
 */
export async function guardAdmin(req: Request, opts: GuardOptions = {}): Promise<GuardResult> {
  const { user } = await resolveRouteUser(req)
  if (!user) return deny(401, 'Sign in to continue.', 'unauthenticated')

  const service = createServiceRoleClient()
  const staffCtx = await resolveStaff(service, user)
  if (!staffCtx) return deny(403, 'Not authorized.', 'not_staff')
  if (staffCtx.staff.status !== 'active') return deny(403, 'This staff account is suspended.', 'suspended')

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get(ADMIN_CSRF_HEADER) !== ADMIN_CSRF_VALUE) {
    return deny(403, 'Missing request header.', 'csrf')
  }

  let session: AdminSessionRow | null = null
  if (!opts.sessionOptional) {
    const token = readSessionToken(req)
    session = token ? await validateAdminSession(service, token, user.id) : null
    if (!session) return deny(401, 'Admin session locked. Unlock the portal to continue.', 'locked')
  }

  const needed = opts.permission ? (Array.isArray(opts.permission) ? opts.permission : [opts.permission]) as readonly Permission[] : []
  if (needed.length > 0 && !canAny(staffCtx.permissions, needed)) {
    return deny(403, 'Your role does not allow this.', 'forbidden')
  }

  const ip = clientIp(req)
  const userAgent = req.headers.get('user-agent')
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
