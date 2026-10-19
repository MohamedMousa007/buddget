import { chooseLocale, type EmailLocale } from '@/lib/email/scenarios'
import type { RenderableTemplate } from '@/lib/email/render'
import type { EmailVars } from '@/lib/email/variables'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import { renderEmail } from './render'
import { resolveUserLocale } from './store'

const DEFAULT_FROM = 'Buddget <no-reply@buddget.app>'
const SEND_TIMEOUT_MS = 4000

export interface Recipient {
  email: string
  id?: string | null
  firstName?: string | null
  fullName?: string | null
  /** Overrides the saved language preference. */
  locale?: EmailLocale
}

export interface SendOptions {
  service?: ServiceClient
  source?: 'auth_hook' | 'admin' | 'system'
  /** Labels the email TEST and marks the log row. */
  test?: boolean
  idempotencyKey?: string
  /** Sends this content instead of the published template (the editor's test send). */
  override?: RenderableTemplate
}

export type SendResult = { ok: true; providerId: string | null; locale: EmailLocale } | { ok: false; error: string }

const TEST_BANNER = '<div style="background:#FFF4CC; color:#6B4E00; font:700 12px/1 Arial,sans-serif; letter-spacing:1px; text-align:center; padding:10px;">TEST EMAIL</div>'

function truncate(s: string): string {
  return s.replace(/\s+/g, ' ').slice(0, 300)
}

/**
 * Renders `key` in the recipient's language and sends it through Resend (4s timeout, idempotent), then records the
 * attempt in `email_log`. The log keeps who, what and the provider's answer, never the variables: codes and links stay out.
 */
export async function sendTemplatedEmail(key: string, to: Recipient, vars: EmailVars, opts: SendOptions = {}): Promise<SendResult> {
  const service = opts.service ?? createServiceRoleClient()
  const source = opts.source ?? 'system'
  const started = Date.now()
  let locale: EmailLocale = to.locale ?? 'en'
  let status: 'sent' | 'failed' = 'failed'
  let providerId: string | null = null
  let error: string | null = null

  try {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    locale = to.locale ?? chooseLocale(await resolveUserLocale(service, to.id))
    const rendered = await renderEmail(service, key, locale, { email: to.email, first_name: to.firstName ?? undefined, full_name: to.fullName ?? undefined, ...vars }, opts.override)
    locale = rendered.locale
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': opts.idempotencyKey ?? crypto.randomUUID(),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to.email],
        subject: opts.test ? `[TEST] ${rendered.subject}` : rendered.subject,
        html: opts.test ? rendered.html.replace(/<body[^>]*>/i, (m) => m + TEST_BANNER) : rendered.html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'rejected'}`)
    providerId = body.id ?? null
    status = 'sent'
  } catch (e) {
    error = truncate(e instanceof Error ? e.message : 'send failed')
    console.error('[email/send]', key, error)
  }

  const { error: logError } = await service.from('email_log').insert({
    user_id: to.id ?? null,
    to_email: to.email,
    template_key: key,
    locale,
    provider_message_id: providerId,
    status,
    error,
    latency_ms: Date.now() - started,
    source,
    is_test: !!opts.test,
  })
  if (logError) console.error('[email/send] log failed', logError.message)

  return status === 'sent' ? { ok: true, providerId, locale } : { ok: false, error: error ?? 'send failed' }
}
