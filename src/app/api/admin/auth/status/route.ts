import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { guardAdmin, json } from '@/lib/server/admin/guard'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * What the portal needs to choose between the sign-in screen and the portal itself. It reads the admin session
 * only: the buddget app sign-in is never consulted, so nothing here says whether an app account is staff.
 */
export async function GET(req: Request) {
  const g = await guardAdmin(req)
  const deviceId = await resolveDeviceId(req)
  if (!g.ok) {
    // Lets the native sign-in screen offer biometrics on a phone that was enrolled; the secret is still required.
    const { data } = await createServiceRoleClient().from('admin_biometric_devices').select('device_id').eq('device_id', deviceId).maybeSingle()
    return json({ isStaff: false, session: null, biometricEnrolled: Boolean(data) })
  }
  const { ctx } = g
  const { data: device } = await ctx.service.from('admin_biometric_devices').select('device_id').eq('device_id', deviceId).eq('user_id', ctx.user.id).maybeSingle()
  return json({
    isStaff: true,
    staff: { name: ctx.staff.display_name, email: ctx.staff.email, role: ctx.role.key, roleName: ctx.role.name, rank: ctx.role.rank },
    permissions: [...ctx.permissions],
    session: ctx.session ? { method: ctx.session.method, expiresAt: ctx.session.expires_at, createdAt: ctx.session.created_at } : null,
    biometricEnrolled: Boolean(device),
  })
}
