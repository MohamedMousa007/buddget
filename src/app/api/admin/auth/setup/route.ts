import QRCode from 'qrcode'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, loadCredentials, verifyAccountOwnership } from '@/lib/server/admin/credentials'
import { encryptSecret, hashPassword, passwordProblem } from '@/lib/server/admin/crypto'
import { generateTotpSecret, otpauthUri } from '@/lib/server/admin/totp'

/** Step 1 of first-time setup: choose the admin password and receive an authenticator secret. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ password?: string; accountPassword?: string }>(req)
  if (!body || typeof body.password !== 'string') return bad('Choose an admin password.')

  const existing = await loadCredentials(ctx.service, ctx.user.id)
  if (existing?.totp_confirmed_at) return bad('Security is already set up. Change it from My security.', 409)

  if (!(await allowAttempt(ctx.service, `admin-setup:${ctx.user.id}`, 900, 10))) return bad('Too many attempts. Try again later.', 429)
  if (!(await verifyAccountOwnership(ctx.user, body.accountPassword))) {
    return bad('Confirm your Buddget account password (or sign in again) to continue.', 401)
  }
  const problem = passwordProblem(body.password)
  if (problem) return bad(problem)

  const secret = generateTotpSecret()
  const { error } = await ctx.service.from('admin_credentials').upsert({
    user_id: ctx.user.id,
    password_hash: await hashPassword(body.password),
    totp_secret_enc: encryptSecret(secret),
    totp_confirmed_at: null,
    totp_last_step: null,
    recovery_hashes: [],
    failed_attempts: 0,
    locked_until: null,
    password_changed_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[admin/setup] upsert failed', error.message)
    return bad('Could not start setup.', 500)
  }

  const uri = otpauthUri(secret, ctx.user.email ?? ctx.staff.email)
  await ctx.audit('auth.setup_started')
  return json({ secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) })
}
