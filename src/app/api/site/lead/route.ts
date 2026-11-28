import { NextResponse } from 'next/server'
import { clientIp, rateBucketIp } from '@/lib/server/clientIp'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { memoryGateOk, tooManyRequests } from '@/lib/server/publicApiRateLimit'
import { isRateLimited } from '@/lib/server/rateLimit'

const WINDOW_SECONDS = 60
const MAX_PER_WINDOW = 5
/** One address cannot be entered more than this per hour, from any number of IPs. */
const EMAIL_PER_HOUR = 3
/** Every IP and address together: past this the form answers 429 until tomorrow instead of filling the table. */
const GLOBAL_PER_DAY = 3000

const bodySchema = z.object({
  kind: z.literal('contact'),
  locale: z.enum(['en', 'ar']),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(4000).optional(),
  /** Honeypot: real people never fill it. */
  company: z.string().max(0).optional(),
})

export async function POST(request: Request) {
  const ip = rateBucketIp(clientIp(request))
  if (!memoryGateOk(`site-lead:${ip}`, MAX_PER_WINDOW, WINDOW_SECONDS)) return tooManyRequests(WINDOW_SECONDS)
  const service = createServiceRoleClient()
  // Shared across instances (Postgres); a database hiccup must not lose a sign-up, so it fails open like check-email.
  if (await isRateLimited(service, `site-lead:${ip}`, WINDOW_SECONDS, MAX_PER_WINDOW, true)) return tooManyRequests(WINDOW_SECONDS)

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { kind, locale, email, name, message } = parsed.data
  if (await isRateLimited(service, `site-lead-email:${email}`, 3600, EMAIL_PER_HOUR, true)) return tooManyRequests(3600)
  if (await isRateLimited(service, 'site-lead-day', 86_400, GLOBAL_PER_DAY, true)) return tooManyRequests(86_400)
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const { error } = await service.from('site_leads').insert({ kind, locale, email, name: name ?? null, message })
  if (error) {
    console.error('[site/lead] insert failed', error.code)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
