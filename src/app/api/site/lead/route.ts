import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isRateLimited } from '@/lib/server/rateLimit'

const WINDOW_SECONDS = 60
const MAX_PER_WINDOW = 5

const bodySchema = z.object({
  kind: z.enum(['waitlist', 'contact']),
  locale: z.enum(['en', 'ar']),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(4000).optional(),
  /** Honeypot: real people never fill it. */
  company: z.string().max(0).optional(),
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const service = createServiceRoleClient()
  // Shared across instances (Postgres); a database hiccup must not lose a sign-up, so it fails open like check-email.
  if (await isRateLimited(service, `site-lead:${ip}`, WINDOW_SECONDS, MAX_PER_WINDOW, true)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { kind, locale, email, name, message } = parsed.data
  if (kind === 'contact' && !message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const { error } = await service.from('site_leads').insert({ kind, locale, email, name: name ?? null, message: message ?? null })
  // A repeat waitlist sign-up hits the unique index; the person is already on the list, so that is a success.
  if (error && error.code !== '23505') {
    console.error('[site/lead] insert failed', error.code)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
