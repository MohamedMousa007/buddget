/**
 * POST /api/budget/ai
 *
 * Budget-specific Gemini calls with prompts, schemas and response parsing kept server-side.
 *   { op: 'build',  facts, draft }            -> { data: PlanDraft }   engine draft refined with rationale
 *   { op: 'adjust', lines, text, currency, income } -> { data: AdjustResult }
 *   { op: 'situation', text, currency }    -> { data: answers }  what the user said, as studio answers
 * The model never writes anything: the client previews and applies the result.
 * Auth: Supabase session required. Per-user hourly cap shared across instances (`api_rate_hit`).
 */
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { retryOnOverload } from '@/lib/server/ai/gemini'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota } from '@/lib/server/ai/quota'
import { usageFromPayload } from '@/lib/server/ai/gemini'
import { estimateUnits, type TokenUsage } from '@/lib/server/ai/units'
import {
  ADJUST_SCHEMA,
  BUILD_SCHEMA,
  adjustMessages,
  applyRefinement,
  buildMessages,
  parseAdjust,
  validateAdjustInput,
  validateBuildInput,
} from '@/lib/budget/budgetAi'
import { SITUATION_SCHEMA, parseSituation, situationMessages, validateSituationInput } from '@/lib/budget/situationAi'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MODEL = process.env.GEMINI_MODEL_SMART?.trim() || 'gemini-2.5-flash'
const URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
// api_rate_hit prunes counters older than an hour, so the window cannot be longer.
const RATE_WINDOW_SECONDS = 3600
const MAX_BODY_CHARS = 60_000
const MAX_ADJUST_CHARS = 500
const DEADLINE_MS = 52_000

async function overQuota(userId: string): Promise<boolean> {
  const service = createServiceRoleClient()
  const { limits } = await getUserEntitlements(service, userId)
  const maxHits = limits.ai_budget_per_hour
  if (maxHits === null) return false
  const { data, error } = await service.rpc('api_rate_hit', {
    p_key: `budget-ai:${userId}`,
    p_window_seconds: RATE_WINDOW_SECONDS,
    p_max_hits: maxHits,
  })
  if (error) {
    console.error('[budget/ai] rate-limit rpc failed', error.message)
    return true
  }
  return data === false
}

const MAX_OUTPUT_TOKENS = 4096

/** Quota-gated model call: reserve first, settle with the real token usage after. */
async function askGated(userId: string, apiKey: string, system: string, user: string, schema: object, thinking: number): Promise<{ denied: NextResponse } | { data: unknown | null }> {
  const started = Date.now()
  const quota = await reserveAiQuota({ userId, feature: 'budget', estUnits: estimateUnits(system.length + user.length, MAX_OUTPUT_TOKENS) })
  if (!quota.allowed) return { denied: quotaDeniedResponse(quota) }
  const { data, usage } = await askModel(apiKey, system, user, schema, thinking)
  await settleAiQuota(quota, { model: MODEL, tier: 'smart', latencyMs: Date.now() - started, usage, status: data ? 'ok' : 'error' })
  return { data }
}

async function askModel(apiKey: string, system: string, user: string, schema: object, thinking: number): Promise<{ data: unknown | null; usage: TokenUsage }> {
  const none: TokenUsage = { promptTokens: 0, cachedTokens: 0, outputTokens: 0 }
  // One deadline for the attempt and its retry: two 45s calls would outlive the 60s function and strand the reservation.
  const deadline = AbortSignal.timeout(DEADLINE_MS)
  try {
    const res = await retryOnOverload(
      () =>
        fetch(URL_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: deadline,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
              responseSchema: schema,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              thinkingConfig: { thinkingBudget: thinking },
            },
          }),
        }),
      MODEL,
    )
    if (!res.ok) return { data: null, usage: none }
    const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
    const usage = usageFromPayload(payload)
    try {
      return { data: text ? JSON.parse(text) : null, usage }
    } catch {
      return { data: null, usage }
    }
  } catch {
    return { data: null, usage: none }
  }
}

export async function POST(req: NextRequest) {
  const outdated = await gateOutdatedClient(req)
  if (outdated) return outdated
  const user = await resolveRouteIdentity(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'AI is not configured' }, { status: 503 })

  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (body.op === 'build') {
    const input = validateBuildInput(body)
    if (!input) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (await overQuota(user.id)) return NextResponse.json({ error: 'Budget AI limit reached, try again later' }, { status: 429 })
    const m = buildMessages(input.facts, input.draft)
    const asked = await askGated(user.id, apiKey, m.system, m.user, BUILD_SCHEMA, 1024)
    if ('denied' in asked) return asked.denied
    // The client folds the refinement into its own full draft; the server only vouches that it is usable.
    return applyRefinement(input.draft, asked.data)
      ? NextResponse.json({ data: asked.data }) : NextResponse.json({ error: 'AI could not refine the plan' }, { status: 502 })
  }

  if (body.op === 'adjust') {
    const input = validateAdjustInput(body)
    if (!input || input.text.length > MAX_ADJUST_CHARS) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (await overQuota(user.id)) return NextResponse.json({ error: 'Budget AI limit reached, try again later' }, { status: 429 })
    const m = adjustMessages(input.lines, input.text, input.currency, input.income)
    const asked = await askGated(user.id, apiKey, m.system, m.user, ADJUST_SCHEMA, 512)
    if ('denied' in asked) return asked.denied
    const out = parseAdjust(asked.data)
    return out ? NextResponse.json({ data: out }) : NextResponse.json({ error: 'AI could not read that' }, { status: 502 })
  }

  if (body.op === 'situation') {
    const input = validateSituationInput(body)
    if (!input) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (await overQuota(user.id)) return NextResponse.json({ error: 'Budget AI limit reached, try again later' }, { status: 429 })
    const m = situationMessages(input.text, input.currency)
    const asked = await askGated(user.id, apiKey, m.system, m.user, SITUATION_SCHEMA, 0)
    if ('denied' in asked) return asked.denied
    // An empty object is a valid answer: the text said nothing the questions can use.
    return asked.data === null ? NextResponse.json({ error: 'AI could not read that' }, { status: 502 }) : NextResponse.json({ data: parseSituation(asked.data) })
  }

  return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
}
