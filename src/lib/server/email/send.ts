import { chooseLocale, type EmailLocale } from '@/lib/email/scenarios'
import type { RenderableTemplate } from '@/lib/email/render'
import type { EmailVars } from '@/lib/email/variables'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'
import { renderEmail } from './render'
import { loadPublished, resolveUserLocale } from './store'
import { isSuppressed } from './suppression'

const DEFAULT_FROM = 'buddget <no-reply@buddget.app>'
const SEND_TIMEOUT_MS = 4000
/** Supabase allows the whole Send Email hook 5 s (not configurable); Resend must answer well inside that. */
const AUTH_HOOK_TIMEOUT_MS = 2500

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
  /** Runs the `email_log` write after the response (the hook passes `after`), so logging never counts against the hook's 5 s. */
  defer?: (task: () => Promise<void>) => void
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

  const apiKey = process.env.RESEND_API_KEY?.trim()
  // Dev and QA servers run without a key; logging their failures only flooded the live email_log (thousands of rows, QA-10 §7).
  if (!apiKey && process.env.VERCEL_ENV !== 'production') return { ok: false, error: 'RESEND_API_KEY is not set' }

  try {
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    // Sign-in mail is exempt: someone asking for a code must receive it, and Resend keeps its own bounce protection.
    if (source !== 'auth_hook' && (await isSuppressed(service, to.email))) throw new Error('Recipient is on the suppression list')
    // One round trip: the saved language and both published templates load together (the render then reads the cache).
    const [saved] = await Promise.all([
      to.locale ? undefined : resolveUserLocale(service, to.id),
      opts.override ? null : loadPublished(service, key, 'en'),
      opts.override ? null : loadPublished(service, key, 'ar'),
    ])
    locale = to.locale ?? chooseLocale(saved)
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
      signal: AbortSignal.timeout(source === 'auth_hook' ? AUTH_HOOK_TIMEOUT_MS : SEND_TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'rejected'}`)
    providerId = body.id ?? null
    status = 'sent'
  } catch (e) {
    error = truncate(e instanceof Error ? e.message : 'send failed')
    console.error('[email/send]', key, error)
  }

  const row = {
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
  }
  const log = async () => {
    let { error: logError } = await service.from('email_log').insert(row)
    // A sign-up hook runs before the new user's row is committed, so the user link fails its foreign key: keep the row without it.
    if (logError?.code === '23503' && row.user_id) ({ error: logError } = await service.from('email_log').insert({ ...row, user_id: null }))
    if (logError) console.error('[email/send] log failed', logError.message)
  }
  if (opts.defer) opts.defer(log)
  else await log()

  return status === 'sent' ? { ok: true, providerId, locale } : { ok: false, error: error ?? 'send failed' }
}
