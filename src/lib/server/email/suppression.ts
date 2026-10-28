import type { ServiceClient } from '@/lib/supabase/service'

const DAY_MS = 86_400_000

/** How long an address stays blocked after Resend reports it. */
export const SUPPRESSION_DAYS = { bounced: 30, complained: 90 } as const

export type SuppressionReason = keyof typeof SUPPRESSION_DAYS

export interface SuppressionRow {
  email: string
  reason: SuppressionReason
  expires_at: string
}

interface ResendEventData {
  to?: string[]
  bounce?: { type?: string }
}

/** The suppression a Resend delivery event calls for: hard bounces and complaints only; soft bounces and delivery failures are transient. */
export function suppressionFor(type: string | undefined, data: ResendEventData | undefined, now = Date.now()): SuppressionRow[] {
  const reason: SuppressionReason | null = type === 'email.complained' ? 'complained' : type === 'email.bounced' && (data?.bounce?.type ?? 'Permanent').toLowerCase() === 'permanent' ? 'bounced' : null
  if (!reason) return []
  const expires_at = new Date(now + SUPPRESSION_DAYS[reason] * DAY_MS).toISOString()
  return (data?.to ?? []).filter((e) => typeof e === 'string' && e.includes('@')).map((e) => ({ email: e.trim().toLowerCase(), reason, expires_at }))
}

type SuppressionTable = {
  upsert: (rows: SuppressionRow[], opts: { onConflict: string }) => PromiseLike<{ error: { message: string } | null }>
  select: (cols: string) => { eq: (c: string, v: string) => { gt: (c: string, v: string) => { limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } } }
}
const table = (service: ServiceClient) => (service as unknown as { from: (t: string) => SuppressionTable }).from('email_suppressions')

export async function recordSuppressions(service: ServiceClient, rows: SuppressionRow[]): Promise<boolean> {
  if (rows.length === 0) return true
  const { error } = await table(service).upsert(rows, { onConflict: 'email' })
  if (error) console.error('[email/suppression] write failed', error.message)
  return !error
}

/** True while the address is on the list. A failed lookup lets the mail through: a broken list must not block sign-in. */
export async function isSuppressed(service: ServiceClient, email: string): Promise<boolean> {
  const { data, error } = await table(service).select('email').eq('email', email.trim().toLowerCase()).gt('expires_at', new Date().toISOString()).limit(1)
  if (error) {
    console.error('[email/suppression] lookup failed', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

/** Same webhook delivery + same email + same recipient = the same Resend send, so a retry cannot mail twice. */
export function authHookIdempotencyKey(webhookId: string | null, templateKey: string, to: string): string | undefined {
  if (!webhookId) return undefined
  return `auth-hook:${webhookId}:${templateKey}:${to.trim().toLowerCase()}`.slice(0, 256)
}
