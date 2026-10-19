import { NextResponse } from 'next/server'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { clientIp } from '@/lib/server/admin/guard'
import { loadCredentials } from '@/lib/server/admin/credentials'
import { readSessionToken, validateAdminSession } from '@/lib/server/admin/session'
import { resolveSsoSession } from '@/lib/server/admin/sso'
import { resolveStaff } from '@/lib/server/admin/staff'

/**
 * What the client needs to decide between: no icon, setup, unlock, or the portal.
 * Answers 200 `{ isStaff: false }` for everyone else so the header icon check leaks nothing.
 */
export async function GET(req: Request) {
  const { user } = await resolveRouteUser(req)
  const headers = { 'Cache-Control': 'no-store' }
  if (!user) return NextResponse.json({ isStaff: false, signedIn: false }, { headers })

  const service = createServiceRoleClient()
  const ctx = await resolveStaff(service, user)
  if (!ctx || ctx.staff.status !== 'active') return NextResponse.json({ isStaff: false, signedIn: true }, { headers })

  // Independent lookups run together: each is a round trip to the database.
  const token = readSessionToken(req)
  const [cred, own, biometric] = await Promise.all([
    loadCredentials(service, user.id),
    token ? validateAdminSession(service, token, user.id) : Promise.resolve(null),
    resolveDeviceId(req).then((deviceId) =>
      service.from('admin_biometric_devices').select('device_id').eq('device_id', deviceId).eq('user_id', user.id).maybeSingle(),
    ),
  ])
  const session = own ?? (await resolveSsoSession(service, user, ctx, { ip: clientIp(req), userAgent: req.headers.get('user-agent') }, cred))
  const biometricEnrolled = Boolean(cred?.setup_completed_at && biometric.data)

  return NextResponse.json(
    {
      isStaff: true,
      signedIn: true,
      staff: { name: ctx.staff.display_name, email: ctx.staff.email, role: ctx.role.key, roleName: ctx.role.name, rank: ctx.role.rank },
      permissions: [...ctx.permissions],
      setup: cred?.setup_completed_at ? 'complete' : cred ? 'confirm_email' : 'needed',
      ssoEnabled: cred?.sso_enabled ?? true,
      session: session ? { method: session.method, expiresAt: session.expires_at, createdAt: session.created_at } : null,
      biometricEnrolled,
    },
    { headers },
  )
}
