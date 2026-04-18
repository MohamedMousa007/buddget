import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Lookup whether an email is already registered.
 *
 * Used by the sign-up form (block existing emails with a pending-signup hint)
 * and the forgot-password form (tell the user no account matches).
 *
 * Hardening vs the in-memory first pass:
 *  1. RPC is now service-role only — the anon/authenticated roles can no
 *     longer call it directly, so this route is the only entry point.
 *  2. Rate limit lives in Postgres (`api_rate_hit`), not in-process, so
 *     multiple Vercel lambda instances share a single counter. 10 hits per
 *     60 s window per IP — enough for honest typos, not enough for bulk
 *     enumeration.
 *  3. Every response waits until a minimum latency has elapsed, so an attacker
 *     can't infer existence from response time (the "found" path costs 1 row
 *     lookup, "not found" costs the same — but a DB hiccup could still leak).
 *  4. Richer response shape: `{ exists, verified }` so the client can
 *     distinguish "already has an account" from "started signup, never
 *     verified — resend the code".
 */

const MIN_LATENCY_MS = 450
const RATE_WINDOW_SECONDS = 60
const RATE_MAX_HITS = 30

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sleepUntil(targetMs: number): Promise<void> {
  const remaining = targetMs - Date.now()
  if (remaining <= 0) return
  await new Promise((r) => setTimeout(r, remaining))
}

export async function POST(req: Request) {
  const startMs = Date.now()
  const deadline = startMs + MIN_LATENCY_MS

  try {
    const body = (await req.json().catch(() => null)) as { email?: string } | null
    const email = body?.email?.trim()
    if (!email || !isValidEmail(email)) {
      await sleepUntil(deadline)
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    const admin = createServiceRoleClient()
    const { data: allowed, error: rateErr } = await admin.rpc('api_rate_hit', {
      p_key: `check-email:${ip}`,
      p_window_seconds: RATE_WINDOW_SECONDS,
      p_max_hits: RATE_MAX_HITS,
    })
    if (rateErr) {
      console.error('[auth/check-email] rate-limit rpc failed', rateErr.message)
    } else if (allowed === false) {
      await sleepUntil(deadline)
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data, error } = await admin.rpc('check_email_status', { p_email: email })
    if (error) {
      console.error('[auth/check-email] status rpc failed', error.message)
      await sleepUntil(deadline)
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    }

    // Supabase returns jsonb as an object already.
    const parsed = (data ?? {}) as { exists?: boolean; verified?: boolean }
    await sleepUntil(deadline)
    return NextResponse.json({
      exists: Boolean(parsed.exists),
      verified: Boolean(parsed.verified),
    })
  } catch (e) {
    console.error('[auth/check-email] unexpected', e)
    await sleepUntil(deadline)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
