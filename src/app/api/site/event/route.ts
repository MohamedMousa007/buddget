import { NextResponse } from 'next/server'
import { clientIp, rateBucketIp } from '@/lib/server/clientIp'
import { z } from 'zod'
import { SITE_LOCALES } from '@/lib/site/config'
import { listRoutes } from '@/lib/site/routes'
import { memoryGateOk, tooManyRequests } from '@/lib/server/publicApiRateLimit'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'

const WINDOW_SECONDS = 60
const MAX_PER_WINDOW = 120

const KNOWN_PATHS = new Set(SITE_LOCALES.flatMap((l) => listRoutes(l).map((r) => (r.slug ? `/${l}/${r.slug}` : `/${l}`))))

const bodySchema = z.object({
  path: z.string().max(200).refine((p) => KNOWN_PATHS.has(p)),
  event: z.enum(['view', 'cta_click', 'lead_submit']),
  /** Hostname of an external referrer. Never a full URL. */
  ref: z.string().max(100).regex(/^[a-z0-9.-]*$/i).default(''),
})

/** Cookieless counter: stores a daily total per page and event, never anything about the visitor. */
export async function POST(request: Request) {
  const ip = rateBucketIp(clientIp(request))
  if (!memoryGateOk(`site-event:${ip}`, MAX_PER_WINDOW, WINDOW_SECONDS)) return tooManyRequests(WINDOW_SECONDS)
  const service = createServiceRoleClient()
  if (await isRateLimited(service, `site-event:${ip}`, WINDOW_SECONDS, MAX_PER_WINDOW, true)) return tooManyRequests(WINDOW_SECONDS)

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { path, event, ref } = parsed.data
  const { error } = await service.rpc('site_stat_bump', { p_path: path, p_locale: path.startsWith('/ar') ? 'ar' : 'en', p_event: event, p_ref: ref })
  if (error) {
    console.error('[site/event] bump failed', error.code)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
