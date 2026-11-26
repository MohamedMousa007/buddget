import { createHash, timingSafeEqual } from 'node:crypto'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { bad, guardSignIn, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, isLocked, loadCredentials } from '@/lib/server/admin/credentials'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Sign in with the device biometric. The device proves a local biometric check by presenting a secret that was
 * enrolled from a signed-in admin session; the device, not the buddget app sign-in, names the staff member.
 */
export async function POST(req: Request) {
  const body = await readJson<{ secret?: string }>(req)
  const secret = typeof body?.secret === 'string' ? body.secret.trim() : ''
  if (!secret) return bad('Missing secret.')

  const deviceId = await resolveDeviceId(req)
  const { data: row } = await createServiceRoleClient().from('admin_biometric_devices').select('user_id, secret_hash').eq('device_id', deviceId).maybeSingle()
  const g = await guardSignIn(req, { userId: row?.user_id })
  if (!g.ok) return g.res.status === 401 ? bad('Biometric unlock is not set up on this device.', 401) : g.res
  const { ctx } = g

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at) return bad('Finish security setup first.', 409)
  if (isLocked(cred)) return bad('Biometric unlock is not set up on this device.', 401)
  if (!(await allowAttempt(ctx.service, `admin-bio:${ctx.user.id}`, 900, 12))) return bad('Too many attempts.', 429)

  const provided = createHash('sha256').update(secret).digest()
  const stored = row ? Buffer.from(row.secret_hash, 'hex') : null
  if (!stored || stored.length !== provided.length || !timingSafeEqual(stored, provided)) {
    await ctx.audit('auth.biometric_failed')
    return bad('Biometric unlock is not set up on this device.', 401)
  }

  await ctx.service.from('admin_biometric_devices').update({ last_used_at: new Date().toISOString() }).eq('device_id', deviceId)
  await ctx.service.from('admin_staff').update({ last_login_at: new Date().toISOString() }).eq('id', ctx.staff.id)
  const session = await createAdminSession(ctx.service, { userId: ctx.user.id, method: 'biometric', ip: ctx.ip, userAgent: ctx.userAgent })
  await ctx.audit('auth.login', { metadata: { via: 'biometric' } })
  return json({ token: session.token, expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } })
}
