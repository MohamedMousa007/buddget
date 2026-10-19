import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { revokeAdminSession, revokeAllAdminSessions } from '@/lib/server/admin/session'

/** The caller's own security overview: active sessions and enrolled biometric devices. */
export async function GET(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const [sessions, devices, cred, currentDevice] = await Promise.all([
    ctx.service
      .from('admin_sessions')
      .select('id, method, ip, user_agent, created_at, last_seen_at, expires_at')
      .eq('user_id', ctx.user.id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    ctx.service.from('admin_biometric_devices').select('device_id, label, platform, created_at, last_used_at').eq('user_id', ctx.user.id),
    ctx.service.from('admin_credentials').select('recovery_hashes, password_changed_at').eq('user_id', ctx.user.id).maybeSingle(),
    resolveDeviceId(req),
  ])
  return json({
    sessions: (sessions.data ?? []).map((s) => ({ ...s, current: s.id === ctx.session?.id })),
    devices: (devices.data ?? []).map((d) => ({ ...d, current: d.device_id === currentDevice })),
    recoveryCodesLeft: cred.data?.recovery_hashes.length ?? 0,
    passwordChangedAt: cred.data?.password_changed_at ?? null,
  })
}

export async function DELETE(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ id?: string; all?: boolean }>(req)
  if (body?.all) {
    await revokeAllAdminSessions(ctx.service, ctx.user.id, ctx.session?.id)
    await ctx.audit('auth.sessions_revoked_all')
    return json({ ok: true })
  }
  if (typeof body?.id !== 'string') return bad('Missing session id.')
  const { data } = await ctx.service.from('admin_sessions').select('id').eq('id', body.id).eq('user_id', ctx.user.id).maybeSingle()
  if (!data) return bad('Session not found.', 404)
  await revokeAdminSession(ctx.service, data.id)
  await ctx.audit('auth.session_revoked')
  return json({ ok: true })
}
