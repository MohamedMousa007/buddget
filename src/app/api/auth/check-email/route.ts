import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Lookup whether an email is already registered.
 *
 * Used by the sign-up form (block existing emails) and the forgot-password form
 * (tell the user no account matches instead of silently sending no mail).
 *
 * Uses a SECURITY DEFINER RPC (`check_email_exists`) via the service-role client.
 * Minimal rate-limiting at the route layer: one request per email per 2s window
 * per IP. For stronger defence-in-depth against enumeration, move to the edge /
 * a Postgres rate limiter.
 */
const RECENT_BY_IP = new Map<string, number>()
const WINDOW_MS = 2000

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const last = RECENT_BY_IP.get(ip) ?? 0
  if (now - last < WINDOW_MS) return true
  RECENT_BY_IP.set(ip, now)
  // Gentle cleanup of the map so it doesn't grow unbounded in long-running workers.
  if (RECENT_BY_IP.size > 2000) {
    for (const [k, ts] of RECENT_BY_IP.entries()) {
      if (now - ts > WINDOW_MS * 10) RECENT_BY_IP.delete(k)
    }
  }
  return false
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string } | null
    const email = body?.email?.trim()
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const admin = createServiceRoleClient()
    const { data, error } = await admin.rpc('check_email_exists', { p_email: email })
    if (error) {
      console.error('[auth/check-email] rpc failed', error.message)
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    }
    return NextResponse.json({ exists: Boolean(data) })
  } catch (e) {
    console.error('[auth/check-email] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
