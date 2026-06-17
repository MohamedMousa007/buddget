import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { getEffectiveAiRuntimeConfig } from '@/lib/server/aiRuntimeConfig'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

/** When Supabase auth is enabled, AI routes require a logged-in user (quota / abuse protection). */
async function requireUserOrUnauthorized(
  req: Request,
): Promise<{ denied: NextResponse } | { userId: string | null }> {
  if (!isSupabaseConfigured()) return { userId: null }
  const { user } = await resolveRouteUser(req)
  if (!user) {
    return {
      denied: NextResponse.json({ error: 'Unauthorized', stage: 'extract' }, { status: 401 }),
    }
  }
  return { userId: user.id }
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/** Per-client request timestamps (sliding window; limits from admin/runtime config). */
const hitTimestamps = new Map<string, number[]>()

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  const ua = req.headers.get('user-agent') || ''
  return `anon-${ua.slice(0, 50)}`
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
  const started = Date.now()
  try {
    const auth = await requireUserOrUnauthorized(req)
    if ('denied' in auth) {
      console.error('[AI] fail status=401 reason=unauthorized')
      return auth.denied
    }
    const userId = auth.userId ?? 'anon'

    const runtime = getEffectiveAiRuntimeConfig()

    const apiKey = process.env.GEMINI_API_KEY?.trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.', stage: 'extract' },
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
    const { contents, generationConfig } = body as {
      contents?: unknown[]
      generationConfig?: Record<string, unknown>
    }

    if (!Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const geminiBody: Record<string, unknown> = { contents }
    if (generationConfig && typeof generationConfig === 'object') {
      geminiBody.generationConfig = generationConfig
    }

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    })

    const payload = await response.json()

    if (!response.ok) {
      const errorMsg = payload?.error?.message || `Gemini API returned ${response.status}`
      console.error(`[AI] fail status=${response.status} user=${userId} latency=${Date.now() - started}ms err=${errorMsg}`)
      return NextResponse.json({ error: errorMsg, stage: 'extract' }, { status: response.status })
    }

    console.info(`[AI] ok user=${userId} latency=${Date.now() - started}ms`)
    return NextResponse.json(payload)
  } catch (err) {
    console.error(`[AI] fail status=500 latency=${Date.now() - started}ms err=${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: 'Failed to process AI request', stage: 'extract' }, { status: 500 })
  }
}

export async function GET() {
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
