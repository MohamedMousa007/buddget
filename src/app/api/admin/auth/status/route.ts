import { NextResponse } from 'next/server'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { loadCredentials } from '@/lib/server/admin/credentials'
import { readSessionToken, validateAdminSession } from '@/lib/server/admin/session'
import { resolveStaff } from '@/lib/server/admin/staff'

/**
 * What the client needs to decide between: no icon, setup, unlock, or the portal.
 * Answers 200 `{ isStaff: false }` for everyone else so the header icon check leaks nothing.
 */
export async function GET(req: Request) {
  const { user } = await resolveRouteUser(req)
  const headers = { 'Cache-Control': 'no-store' }
  if (!user) return NextResponse.json({ isStaff: false }, { headers })

  const service = createServiceRoleClient()
  const ctx = await resolveStaff(service, user)
  if (!ctx || ctx.staff.status !== 'active') return NextResponse.json({ isStaff: false }, { headers })

  const cred = await loadCredentials(service, user.id)
  const token = readSessionToken(req)
  const session = token ? await validateAdminSession(service, token, user.id) : null

  let biometricEnrolled = false
  if (cred?.totp_confirmed_at) {
    const deviceId = await resolveDeviceId(req)
    const { data } = await service.from('admin_biometric_devices').select('device_id').eq('device_id', deviceId).eq('user_id', user.id).maybeSingle()
    biometricEnrolled = !!data
  }

  return NextResponse.json(
    {
      isStaff: true,
      staff: { name: ctx.staff.display_name, email: ctx.staff.email, role: ctx.role.key, roleName: ctx.role.name, rank: ctx.role.rank },
      permissions: [...ctx.permissions],
      setup: cred?.totp_confirmed_at ? 'complete' : cred ? 'confirm_totp' : 'needed',
      hasAccountPassword: (user.identities ?? []).some((i) => i.provider === 'email'),
      session: session ? { method: session.method, expiresAt: session.expires_at, createdAt: session.created_at } : null,
      biometricEnrolled,
    },
    { headers },
  )
}
