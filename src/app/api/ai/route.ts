import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveAiRuntimeConfig } from '@/lib/server/aiRuntimeConfig'

function supabaseAuthConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}

/** When Supabase auth is enabled, AI routes require a logged-in user (quota / abuse protection). */
async function requireUserOrUnauthorized(): Promise<NextResponse | null> {
  if (!supabaseAuthConfigured()) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/** Per-client request timestamps (sliding window; limits from admin/runtime config). */
const hitTimestamps = new Map<string, number[]>()

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  const prev = hitTimestamps.get(key) ?? []
  const recent = prev.filter((t) => t > windowStart)
  if (recent.length >= max) {
    hitTimestamps.set(key, recent)
    return true
  }
  recent.push(now)
  hitTimestamps.set(key, recent)
  return false
}

export async function POST(req: Request) {
  try {
    const authDenied = await requireUserOrUnauthorized()
    if (authDenied) return authDenied

    const runtime = getEffectiveAiRuntimeConfig()

    const apiKey = process.env.GEMINI_API_KEY?.trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.' },
        { status: 503 }
      )
    }

    if (runtime.rateLimitingEnabled) {
      const key = clientKey(req)
      if (isRateLimited(key, runtime.rateLimitMaxRequests, runtime.rateLimitWindowMs)) {
        const waitSec = Math.ceil(runtime.rateLimitWindowMs / 1000)
        return NextResponse.json(
          {
            error: `Too many AI requests. This server allows ${runtime.rateLimitMaxRequests} requests per ${waitSec}s per device. Turn off throttling in Admin if you are the only user, or wait.`,
          },
          { status: 429 }
        )
      }
    }

    const body = await req.json()
    const { contents, generationConfig } = body

    if (!Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request payload' },
        { status: 400 }
      )
    }

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig }),
    })

    const payload = await response.json()

    if (!response.ok) {
      const errorMsg = payload?.error?.message || `Gemini API returned ${response.status}`
      console.error('[AI Route] Gemini error:', errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      )
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[AI Route] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const authDenied = await requireUserOrUnauthorized()
  if (authDenied) return authDenied

  const hasKey = !!process.env.GEMINI_API_KEY?.trim()
  const runtime = getEffectiveAiRuntimeConfig()
  return NextResponse.json({
    enabled: hasKey,
    model: GEMINI_MODEL,
    rateLimit: {
      limitingEnabled: runtime.rateLimitingEnabled,
      maxRequests: runtime.rateLimitMaxRequests,
      windowMs: runtime.rateLimitWindowMs,
    },
  })
}
