import { bad, guardAdmin, json } from '@/lib/server/admin/guard'
import { allowAttempt, loadCredentials } from '@/lib/server/admin/credentials'
import { sendEmailCode } from '@/lib/server/admin/emailCode'

/**
 * Emails the signed-in staff member a fresh 6-digit code. The code only ever goes to the account's own address;
 * what it unlocks is decided by whichever endpoint later verifies it (unlock, setup, step-up, a security change).
 */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred) return json({ error: 'Choose your admin password first.', code: 'setup_required' }, 409)
  if (!ctx.user.email) return bad('This account has no email.', 409)

  const throttled =
    !(await allowAttempt(ctx.service, `admin-code:${ctx.user.id}`, 3600, 8)) ||
    !(await allowAttempt(ctx.service, `admin-code-ip:${ctx.ip}`, 3600, 30))
  if (throttled) return bad('Too many codes requested. Try again later.', 429)

  const sent = await sendEmailCode(ctx.service, ctx.user.email, ctx.user.id)
  if (!sent.ok) return bad(sent.status === 429 ? 'Please wait a minute before asking for another code.' : 'We could not send the code. Try again.', sent.status)
  await ctx.audit('auth.code_sent')
  return json({ ok: true })
}
