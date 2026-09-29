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

/** Untiered callers (budget parser, emergency-fund estimator) keep the model they were tuned on. */
const GEMINI_MODEL = process.env.GEMINI_MODEL_LEGACY?.trim() || 'gemini-2.5-flash'

/**
 * Buddgy's tiers. `fast` = quick capture (voice → transaction), `smart` = chat and
 * reasoning. 2.5 is ~4-5× cheaper per token than 3.5 Flash and does this job well;
 * when Google retires it, set GEMINI_MODEL_SMART/FAST (e.g. a 3.x model) — no code change.
 */
const TIER_MODELS = {
  fast: process.env.GEMINI_MODEL_FAST?.trim() || 'gemini-2.5-flash-lite',
  smart: process.env.GEMINI_MODEL_SMART?.trim() || 'gemini-2.5-flash',
} as const
type Tier = keyof typeof TIER_MODELS

const THINKING_BUDGET: Record<string, number> = { minimal: 0, low: 512, medium: 2048, high: 8192 }

function geminiUrl(model: string, stream: boolean, apiKey: string): string {
  const method = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}key=${apiKey}`
}

/** 2.x models speak `thinkingBudget`; 3.x speak `thinkingLevel`. */
function configFor(model: string, config: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return model.startsWith('gemini-2.') ? toLegacyConfig(config) : config
}

function toLegacyConfig(config: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const thinking = config?.thinkingConfig as { thinkingLevel?: string } | undefined
  if (!thinking?.thinkingLevel) return config
  return { ...config, thinkingConfig: { thinkingBudget: THINKING_BUDGET[thinking.thinkingLevel] ?? 0 } }
}

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
    const { contents, generationConfig, grounded, systemInstruction, tier, stream } = body as {
      contents?: unknown[]
      generationConfig?: Record<string, unknown>
      systemInstruction?: unknown
      tier?: Tier
      /** Server-sent events straight from Gemini, so the first words show immediately. */
      stream?: boolean
      /** Opt-in Google Search grounding — set ONLY by callers that need live facts (e.g. the
       *  emergency-fund estimator). Off by default so ordinary AI calls don't pay the token cost. */
      grounded?: boolean
    }

    if (!Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const geminiBody: Record<string, unknown> = { contents }
    if (generationConfig && typeof generationConfig === 'object') {
      geminiBody.generationConfig = generationConfig
    }
    if (grounded === true) {
      geminiBody.tools = [{ google_search: {} }]
    }
    if (systemInstruction) geminiBody.systemInstruction = systemInstruction

    const model = tier && tier in TIER_MODELS ? TIER_MODELS[tier] : GEMINI_MODEL
    const call = (m: string) =>
      fetch(geminiUrl(m, stream === true, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...geminiBody, generationConfig: configFor(m, geminiBody.generationConfig as Record<string, unknown>) }),
      })

    let response = await call(model)
    // A tier model this key can't reach or doesn't accept (404/403/400) falls back to
    // the legacy model rather than taking Buddgy offline. 429 is quota, not the model.
    if (response.status >= 400 && response.status < 500 && response.status !== 429 && model !== GEMINI_MODEL) {
      console.error(`[AI] model=${model} status=${response.status}, falling back to ${GEMINI_MODEL}`)
      response = await call(GEMINI_MODEL)
    }

    if (stream === true && response.ok && response.body) {
      console.info(`[AI] ok stream user=${userId} model=${model} ttfb=${Date.now() - started}ms`)
      return new Response(response.body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
      })
    }

    const payload = await response.json()

    if (!response.ok) {
      const errorMsg = payload?.error?.message || `Gemini API returned ${response.status}`
      console.error(`[AI] fail status=${response.status} user=${userId} latency=${Date.now() - started}ms err=${errorMsg}`)
      return NextResponse.json({ error: errorMsg, stage: 'extract' }, { status: response.status })
    }

    console.info(`[AI] ok user=${userId} model=${model} latency=${Date.now() - started}ms`)
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
    model: TIER_MODELS.smart,
    rateLimit: {
      limitingEnabled: runtime.rateLimitingEnabled,
      maxRequests: runtime.rateLimitMaxRequests,
      windowMs: runtime.rateLimitWindowMs,
    },
  })
}
