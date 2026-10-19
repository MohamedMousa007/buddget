import { NextResponse } from 'next/server'
import { planAuthEmails, type HookPayload } from '@/lib/server/email/authHook'
import { sendTemplatedEmail } from '@/lib/server/email/send'
import { verifySignedWebhook } from '@/lib/server/email/webhook'
import { requireSupabaseUrl } from '@/lib/supabase/env'

const fail = (message: string, status: number) => NextResponse.json({ error: { http_code: status, message } }, { status })

/**
 * Supabase "Send Email" auth hook: our templates and mailer replace Supabase's. Enable it under Authentication >
 * Hooks with SEND_EMAIL_HOOK_SECRET. The code and link are passed to the renderer and never stored.
 */
export async function POST(req: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET?.trim()
  if (!secret) return fail('Not configured', 503)
  const body = await req.text()
  const ok = verifySignedWebhook(
    { id: req.headers.get('webhook-id'), timestamp: req.headers.get('webhook-timestamp'), signature: req.headers.get('webhook-signature') },
    body,
    secret,
  )
  if (!ok) return fail('Bad signature', 401)

  let payload: HookPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return fail('Bad body', 400)
  }
  const plan = planAuthEmails(payload, requireSupabaseUrl())
  if (!plan.ok) {
    if (plan.ignored) return NextResponse.json({})
    return fail(plan.error, 422)
  }

  const user = payload.user!
  const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name
  const results = await Promise.all(
    plan.emails.map((e) =>
      sendTemplatedEmail(e.key, { email: e.to, id: user.id ?? null, fullName, firstName: fullName?.split(' ')[0] }, e.vars, { source: 'auth_hook' }),
    ),
  )
  return results.every((r) => r.ok) ? NextResponse.json({}) : fail('Could not send the email', 502)
}
