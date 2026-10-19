import { NextResponse } from 'next/server'
import { sendTemplatedEmail } from '@/lib/server/email/send'
import { verifySignedWebhook } from '@/lib/server/email/webhook'
import { requireSupabaseUrl } from '@/lib/supabase/env'

const SCENARIO: Record<string, string> = {
  signup: 'confirm_signup',
  magiclink: 'sign_in_code',
  recovery: 'password_reset',
  reauthentication: 'reauthentication',
}

interface HookPayload {
  user?: { id?: string; email?: string; user_metadata?: { full_name?: string; name?: string } }
  email_data?: { token?: string; token_hash?: string; redirect_to?: string; email_action_type?: string }
}

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
  const type = payload.email_data?.email_action_type ?? ''
  const key = SCENARIO[type]
  const user = payload.user
  if (!key || !user?.email) return fail(`Unsupported email type: ${type || 'unknown'}`, 422)

  const hash = payload.email_data?.token_hash ?? ''
  const link = `${requireSupabaseUrl()}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(payload.email_data?.redirect_to ?? '')}`
  const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name
  const sent = await sendTemplatedEmail(
    key,
    { email: user.email, id: user.id ?? null, fullName, firstName: fullName?.split(' ')[0] },
    { code: payload.email_data?.token, link },
    { source: 'auth_hook' },
  )
  return sent.ok ? NextResponse.json({}) : fail('Could not send the email', 502)
}
