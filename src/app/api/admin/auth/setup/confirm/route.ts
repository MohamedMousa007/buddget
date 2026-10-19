import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { consumeSecondFactor, loadCredentials } from '@/lib/server/admin/credentials'
import { generateRecoveryCodes } from '@/lib/server/admin/crypto'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

/** Step 2: prove the authenticator works. Returns the one-time recovery codes and unlocks the portal. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ code?: string }>(req)
  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.totp_secret_enc || cred.totp_confirmed_at) return bad('Start setup first.', 409)
  if (typeof body?.code !== 'string' || !/^\d{3}\s?\d{3}$/.test(body.code.trim())) return bad('Enter the 6-digit code.')

  const result = await consumeSecondFactor(ctx.service, cred, body.code)
  if (!result.ok) return bad('That code did not match. Check your authenticator and try again.', 401)

  const { codes, hashes } = generateRecoveryCodes()
  await ctx.service.from('admin_credentials').update({ totp_confirmed_at: new Date().toISOString(), recovery_hashes: hashes }).eq('user_id', ctx.user.id)
  await ctx.service.from('admin_staff').update({ last_login_at: new Date().toISOString() }).eq('id', ctx.staff.id)

  const session = await createAdminSession(ctx.service, { userId: ctx.user.id, method: 'password_totp', ip: ctx.ip, userAgent: ctx.userAgent })
  await ctx.audit('auth.setup_completed')
  return json({ recoveryCodes: codes, token: session.token, expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } })
}
