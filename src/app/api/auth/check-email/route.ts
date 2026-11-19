import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/server/clientIp'
import { isRateLimited } from '@/lib/server/rateLimit'
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
 *     multiple Vercel lambda instances share a single counter. 30 hits per
 *     60 s window per IP — enough for honest typos, not enough for bulk
 *     enumeration.
 *  3. Every response waits until a minimum latency has elapsed, so an attacker
 *     can't infer existence from response time (the "found" path costs 1 row
 *     lookup, "not found" costs the same — but a DB hiccup could still leak).
 *  4. Richer response shape: `{ exists, verified }` so the client can
 *     distinguish "already has an account" from "started signup, never
 *     verified — resend the code".
 */

// The body already says whether the email exists, so a long floor hides nothing; it only slows every signup by this much.
const MIN_LATENCY_MS = 100
const RATE_WINDOW_SECONDS = 60
const RATE_MAX_HITS = 30
const DAY_SECONDS = 86_400
const DAY_MAX_HITS = 300

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
    const body = (await req.json().catch(() => null)) as { email?: unknown } | null
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!email || !isValidEmail(email)) {
      await sleepUntil(deadline)
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const ip = clientIp(req)

    const admin = createServiceRoleClient()
    // QA-99: the email-first modal needs the answer, so it stays; a daily cap bounds bulk enumeration, and a counter outage fails closed.
    if (
      (await isRateLimited(admin, `check-email:${ip}`, RATE_WINDOW_SECONDS, RATE_MAX_HITS)) ||
      (await isRateLimited(admin, `check-email-day:${ip}`, DAY_SECONDS, DAY_MAX_HITS))
    ) {
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
