import { createHash, timingSafeEqual } from 'node:crypto'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, isLocked, loadCredentials } from '@/lib/server/admin/credentials'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

/**
 * Unlock with the device biometric. The device proves a local biometric check by presenting a secret that was
 * enrolled from an already-unlocked session; it only works for the signed-in account the device was enrolled for.
 */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ secret?: string }>(req)
  const secret = typeof body?.secret === 'string' ? body.secret.trim() : ''
  if (!secret) return bad('Missing secret.')

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at) return bad('Finish security setup first.', 409)
  if (isLocked(cred)) return bad('Locked after failed attempts. Use your password and emailed code.', 429)
  if (!(await allowAttempt(ctx.service, `admin-bio:${ctx.user.id}`, 900, 12))) return bad('Too many attempts.', 429)

  const deviceId = await resolveDeviceId(req)
  const { data: row } = await ctx.service
    .from('admin_biometric_devices')
    .select('secret_hash')
    .eq('device_id', deviceId)
    .eq('user_id', ctx.user.id)
    .maybeSingle()

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
