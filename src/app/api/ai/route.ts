import { NextResponse } from 'next/server'
import { getEffectiveAiRuntimeConfig } from '@/lib/server/aiRuntimeConfig'
import { requireAiUser } from '@/lib/server/ai/auth'
import {
  callGemini,
  clampGenerationConfig,
  LEGACY_MODEL,
  tapStreamUsage,
  TIER_MODELS,
  usageFromPayload,
  type Tier,
} from '@/lib/server/ai/gemini'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota, type QuotaGrant } from '@/lib/server/ai/quota'
import { estimateUnits } from '@/lib/server/ai/units'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

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
  let grant: QuotaGrant | null = null
  let model = LEGACY_MODEL
  let tierName = 'legacy'
  try {
    const auth = await requireAiUser(req)
    if ('denied' in auth) {
      console.error('[AI] fail status=denied')
      return auth.denied
    }
    const userId = auth.userId

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

    const config = clampGenerationConfig(generationConfig)
    const geminiBody: Record<string, unknown> = { contents, generationConfig: config }
    if (grounded === true) geminiBody.tools = [{ google_search: {} }]
    if (systemInstruction) geminiBody.systemInstruction = systemInstruction

    tierName = tier && tier in TIER_MODELS ? tier : 'legacy'
    model = tier && tier in TIER_MODELS ? TIER_MODELS[tier] : LEGACY_MODEL

    const quota = await reserveAiQuota({
      userId,
      feature: 'proxy',
      estUnits: estimateUnits(JSON.stringify(contents).length + JSON.stringify(systemInstruction ?? '').length, config.maxOutputTokens as number),
    })
    if (!quota.allowed) return quotaDeniedResponse(quota)
    grant = quota

    const wantStream = stream === true
    let response = await callGemini(model, apiKey, geminiBody, wantStream)
    // A tier model this key can't reach or doesn't accept (404/403/400) falls back to
    // the legacy model rather than taking Buddgy offline. 429 is quota, not the model.
    if (response.status >= 400 && response.status < 500 && response.status !== 429 && model !== LEGACY_MODEL) {
      console.error(`[AI] model=${model} status=${response.status}, falling back to ${LEGACY_MODEL}`)
      model = LEGACY_MODEL
      response = await callGemini(model, apiKey, geminiBody, wantStream)
    }

    const settle = (usage: Parameters<typeof settleAiQuota>[1]['usage'], status: 'ok' | 'error' | 'aborted') =>
      settleAiQuota(quota, { model, tier: tierName, latencyMs: Date.now() - started, usage, status })

    if (wantStream && response.ok && response.body) {
      console.info(`[AI] ok stream user=${userId} model=${model} ttfb=${Date.now() - started}ms`)
      const tapped = tapStreamUsage(response.body, (usage, completed) => {
        void settle(usage, completed ? 'ok' : 'aborted')
      })
      return new Response(tapped, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
      })
    }

    const payload = await response.json()

    if (!response.ok) {
      await settle({ promptTokens: 0, cachedTokens: 0, outputTokens: 0 }, 'error')
      const errorMsg = payload?.error?.message || `Gemini API returned ${response.status}`
      console.error(`[AI] fail status=${response.status} user=${userId} latency=${Date.now() - started}ms err=${errorMsg}`)
      return NextResponse.json({ error: errorMsg, stage: 'extract' }, { status: response.status })
    }

    await settle(usageFromPayload(payload), 'ok')
    console.info(`[AI] ok user=${userId} model=${model} latency=${Date.now() - started}ms`)
    return NextResponse.json(payload)
  } catch (err) {
    if (grant) {
      await settleAiQuota(grant, {
        model,
        tier: tierName,
        latencyMs: Date.now() - started,
        usage: { promptTokens: 0, cachedTokens: 0, outputTokens: 0 },
        status: 'error',
      })
    }
    console.error(`[AI] fail status=500 latency=${Date.now() - started}ms err=${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: 'Failed to process AI request', stage: 'extract' }, { status: 500 })
  }
}

/** Availability probe for the orb. Reveals nothing about models or limits. */
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.GEMINI_API_KEY?.trim(), model: '' })
}
