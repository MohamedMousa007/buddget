import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { consumeSecondFactor, loadCredentials } from '@/lib/server/admin/credentials'
import { generateRecoveryCodes, verifyPassword } from '@/lib/server/admin/crypto'

/** Replace all recovery codes. Shown once. */
export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ password?: string; code?: string }>(req)
  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred || typeof body?.password !== 'string' || typeof body.code !== 'string') return bad('Fill in every field.')

  const passwordOk = await verifyPassword(body.password, cred.password_hash)
  const second = await consumeSecondFactor(ctx.service, cred, body.code)
  if (!passwordOk || !second.ok) return bad('Password or code is incorrect.', 401)

  const { codes, hashes } = generateRecoveryCodes()
  await ctx.service.from('admin_credentials').update({ recovery_hashes: hashes }).eq('user_id', ctx.user.id)
  await ctx.audit('auth.recovery_regenerated')
  return json({ recoveryCodes: codes })
}
