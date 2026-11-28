import { NextResponse } from 'next/server'
import { z } from 'zod'
import { clientIp, rateBucketIp } from '@/lib/server/clientIp'
import { memoryGateOk, tooManyRequests } from '@/lib/server/publicApiRateLimit'
import { isRateLimited } from '@/lib/server/rateLimit'
import { isDisposableEmail } from '@/lib/referrals/disposable'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { APP_INVITE_CODE as APP_CODE, WAITLIST_CHOICES, WAITLIST_SHARE_CODE as SHARE_CODE } from '@/lib/site/waitlist'

const WINDOW_SECONDS = 60
const MAX_PER_WINDOW = 5
const EMAIL_PER_HOUR = 3
/** Every IP and address together: past this the form answers 429 until tomorrow instead of filling the table. */
const GLOBAL_PER_DAY = 3000

const utm = z.string().trim().max(100).optional().transform((v) => v || undefined)

const bodySchema = z.object({
  locale: z.enum(['en', 'ar']),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional().transform((v) => v || undefined),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  platform: z.enum(['ios', 'android']),
  trackingNow: z.enum(WAITLIST_CHOICES.trackingNow).optional(),
  wantMost: z.enum(WAITLIST_CHOICES.wantMost).optional(),
  heardFrom: z.enum(WAITLIST_CHOICES.heardFrom).optional(),
  /** A waitlist share code (W + 7) or an in-app invite code (NAME-XXX); anything else is dropped. */
  ref: z.string().trim().toUpperCase().max(16).optional(),
  utmSource: utm, utmMedium: utm, utmCampaign: utm, utmContent: utm, utmTerm: utm,
  /** Honeypot: real people never fill it. */
  company: z.string().max(200).optional(),
})

export async function POST(request: Request) {
  const ip = rateBucketIp(clientIp(request))
  if (!memoryGateOk(`site-waitlist:${ip}`, MAX_PER_WINDOW, WINDOW_SECONDS)) return tooManyRequests(WINDOW_SECONDS)
  const service = createServiceRoleClient()
  // Shared across instances (Postgres); a database hiccup must not lose a sign-up, so the limiter fails open.
  if (await isRateLimited(service, `site-waitlist:${ip}`, WINDOW_SECONDS, MAX_PER_WINDOW, true)) return tooManyRequests(WINDOW_SECONDS)

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const b = parsed.data
  // A bot that filled the hidden field is told it worked and nothing is saved.
  if (b.company) return NextResponse.json({ ok: true })
  if (isDisposableEmail(b.email)) return NextResponse.json({ error: 'disposable' }, { status: 400 })
  if (await isRateLimited(service, `site-waitlist-email:${b.email}`, 3600, EMAIL_PER_HOUR, true)) return tooManyRequests(3600)
  if (await isRateLimited(service, 'site-waitlist-day', 86_400, GLOBAL_PER_DAY, true)) return tooManyRequests(86_400)

  const ref = b.ref ?? ''
  const { data, error } = await service.rpc('waitlist_join', {
    p_email: b.email, p_locale: b.locale, p_name: b.name, p_country: b.country, p_platform: b.platform,
    p_tracking_now: b.trackingNow, p_want_most: b.wantMost, p_heard_from: b.heardFrom,
    p_referred_by: SHARE_CODE.test(ref) ? ref : undefined,
    p_app_invite_code: APP_CODE.test(ref) ? ref : undefined,
    p_utm_source: b.utmSource, p_utm_medium: b.utmMedium, p_utm_campaign: b.utmCampaign, p_utm_content: b.utmContent, p_utm_term: b.utmTerm,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) {
    console.error('[site/waitlist] join failed', error?.code)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  // A repeat address gets no code: otherwise anyone could read another person's link and count by typing their email.
  if (!row.is_new) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: true, shareCode: row.share_code, referrals: row.referrals })
}
