import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { getEffectiveAiRuntimeConfig } from '@/lib/server/aiRuntimeConfig'
import { requireAiUser } from '@/lib/server/ai/auth'
import {
  callGemini,
  retryOnOverload,
  clampGenerationConfig,
  LEGACY_MODEL,
  tapStreamUsage,
  TIER_MODELS,
  usageFromPayload,
  type Tier,
} from '@/lib/server/ai/gemini'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota, type QuotaGrant } from '@/lib/server/ai/quota'
import { estimateUnits } from '@/lib/server/ai/units'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

/** The largest request body the proxy will read. A chat turn with its context is far below this. */
const MAX_BODY_BYTES = 256 * 1024
const MAX_CONTENTS = 60
/** One deadline across the call, its retry and the model fallback; the function is killed at maxDuration (30s) and would leave the reservation unsettled. */
const UPSTREAM_DEADLINE_MS = 25_000

export async function POST(req: Request) {
  const outdated = await gateOutdatedClient(req)
  if (outdated) return outdated
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

    const runtime = await getEffectiveAiRuntimeConfig()
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured. Admin needs to set GEMINI_API_KEY.', stage: 'extract' },
        { status: 503 }
      )
    }

    if (runtime.rateLimitingEnabled) {
      const waitSec = Math.min(3600, Math.max(1, Math.ceil(runtime.rateLimitWindowMs / 1000)))
      if (await isRateLimited(createServiceRoleClient(), `ai:${userId}`, waitSec, runtime.rateLimitMaxRequests, true)) {
        return NextResponse.json(
          {
            error: `Too many AI requests. This server allows ${runtime.rateLimitMaxRequests} requests per ${waitSec}s per account. Turn off throttling in Admin if you are the only user, or wait.`,
          },
          { status: 429 }
        )
      }
    }

    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }
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

    if (!Array.isArray(contents) || contents.length === 0 || contents.length > MAX_CONTENTS) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const config = clampGenerationConfig(generationConfig)
    const geminiBody: Record<string, unknown> = { contents, generationConfig: config }
    if (grounded === true && tier !== 'fast') geminiBody.tools = [{ google_search: {} }]
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
    const deadline = AbortSignal.timeout(UPSTREAM_DEADLINE_MS)
    let response = await retryOnOverload(() => callGemini(model, apiKey, geminiBody, wantStream, deadline), model)
    // A tier model this key can't reach or doesn't accept (404/403/400) falls back to
    // the legacy model rather than taking Buddgy offline. 429 is quota, not the model.
    if (response.status >= 400 && response.status < 500 && response.status !== 429 && model !== LEGACY_MODEL) {
      console.error(`[AI] model=${model} status=${response.status}, falling back to ${LEGACY_MODEL}`)
      model = LEGACY_MODEL
      await response.body?.cancel().catch(() => undefined)
      response = await retryOnOverload(() => callGemini(model, apiKey, geminiBody, wantStream, deadline), model)
    }

    const estInput = Math.ceil((JSON.stringify(contents).length + JSON.stringify(systemInstruction ?? '').length) / 4)
    const settle = (usage: Parameters<typeof settleAiQuota>[1]['usage'], status: 'ok' | 'error' | 'aborted') =>
      settleAiQuota(quota, {
        model,
        tier: tierName,
        latencyMs: Date.now() - started,
        // An abort before usage was reported still consumed the prompt; never settle it as free.
        usage: status === 'aborted' && usage.promptTokens === 0 ? { promptTokens: estInput, cachedTokens: 0, outputTokens: 0 } : usage,
        status,
      })

    if (wantStream && response.ok && response.body) {
      console.info(`[AI] ok stream user=${userId} model=${model} ttfb=${Date.now() - started}ms`)
      const tapped = tapStreamUsage(response.body, (usage, completed) => settle(usage, completed ? 'ok' : 'aborted'))
      return new Response(tapped, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
      })
    }

    const payload = await response.json()

    if (!response.ok) {
      await settle({ promptTokens: 0, cachedTokens: 0, outputTokens: 0 }, 'error')
      console.error(`[AI] fail status=${response.status} user=${userId} latency=${Date.now() - started}ms err=${payload?.error?.message ?? ''}`)
      // 429 stays so callers back off; anything else is the upstream's problem, never "not configured" (503) or a sign-out (401/403).
      return response.status === 429
        ? NextResponse.json({ error: 'The AI service is busy, try again shortly', stage: 'extract' }, { status: 429 })
        : NextResponse.json({ error: 'The AI service is unavailable, try again', stage: 'extract' }, { status: 502 })
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
