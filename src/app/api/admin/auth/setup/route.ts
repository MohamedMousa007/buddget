import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, loadCredentials } from '@/lib/server/admin/credentials'
import { hashPassword, passwordProblem } from '@/lib/server/admin/crypto'
import { sendEmailCode } from '@/lib/server/admin/emailCode'

/**
 * Step 1 of first-time setup: choose the admin password (separate from the Buddget account password) and get an
 * emailed code. Nothing is usable until the code proves the person can read the mailbox (step 2).
 */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ password?: string }>(req)
  if (!body || typeof body.password !== 'string') return bad('Choose an admin password.')

  const existing = await loadCredentials(ctx.service, ctx.user.id)
  if (existing?.setup_completed_at) return bad('Security is already set up. Change it from My security.', 409)
  if (!ctx.user.email) return bad('This account has no email.', 409)

  if (!(await allowAttempt(ctx.service, `admin-setup:${ctx.user.id}`, 900, 10))) return bad('Too many attempts. Try again later.', 429)
  const problem = passwordProblem(body.password)
  if (problem) return bad(problem)

  const { error } = await ctx.service.from('admin_credentials').upsert({
    user_id: ctx.user.id,
    password_hash: await hashPassword(body.password),
    setup_completed_at: null,
    failed_attempts: 0,
    locked_until: null,
    password_changed_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[admin/setup] upsert failed', error.message)
    return bad('Could not start setup.', 500)
  }

  await ctx.audit('auth.setup_started')
  const sent = await sendEmailCode(ctx.user.email)
  if (!sent.ok) return bad(sent.status === 429 ? 'Please wait a minute before asking for another code.' : 'We could not send the code. Try again.', sent.status)
  return json({ ok: true })
}
