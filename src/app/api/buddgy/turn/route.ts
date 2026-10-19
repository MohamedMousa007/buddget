import { NextResponse } from 'next/server'
import { SPEC_BY_NAME, ALL_SPECS } from '@/lib/buddgy/tools/specs'
import { toGeminiDeclaration } from '@/lib/buddgy/tools/spec'
import { requireAiUser } from '@/lib/server/ai/auth'
import { callGemini, TIER_MODELS } from '@/lib/server/ai/gemini'
import { INTENT_CONFIG, SYSTEM_PROMPT } from '@/lib/server/ai/buddgy/prompt'
import { selectSpecs } from '@/lib/server/ai/buddgy/select'
import { buildContents, turnEventStream } from '@/lib/server/ai/buddgy/turn'
import { parseTurnRequest } from '@/lib/server/ai/buddgy/validate'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota } from '@/lib/server/ai/quota'
import { computeUnits, estimateUnits } from '@/lib/server/ai/units'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const KNOWN_TOOLS: ReadonlySet<string> = new Set(SPEC_BY_NAME.keys())

export async function POST(req: Request) {
  const started = Date.now()
  const auth = await requireAiUser(req)
  if ('denied' in auth) return auth.denied

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const parsed = parseTurnRequest(raw, KNOWN_TOOLS)
  if (!parsed.ok) return NextResponse.json({ error: 'bad_request', reason: parsed.reason }, { status: 400 })
  const turn = parsed.value

  const cfg = INTENT_CONFIG[turn.intent ?? 'answer']
  const model = TIER_MODELS[cfg.tier]
  const contents = buildContents(turn)

  const quota = await reserveAiQuota({
    userId: auth.userId,
    feature: turn.hop ? 'chat_hop' : 'chat',
    chatId: turn.chatId ?? null,
    estUnits: estimateUnits(JSON.stringify(contents).length + SYSTEM_PROMPT.length, cfg.maxOutputTokens),
  })
  if (!quota.allowed) return quotaDeniedResponse(quota)

  const tools = selectSpecs(ALL_SPECS.filter((t) => !quota.disabled.includes(`tool:${t.domain}`)), turn)

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: tools.map(toGeminiDeclaration) }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: {
      maxOutputTokens: cfg.maxOutputTokens,
      temperature: 0.4,
      thinkingConfig: { thinkingBudget: cfg.thinkingBudget },
    },
  }

  let upstream: Response
  try {
    upstream = await callGemini(model, apiKey, body, true, req.signal)
  } catch {
    await settleAiQuota(quota, { model, tier: cfg.tier, latencyMs: Date.now() - started, usage: { promptTokens: 0, cachedTokens: 0, outputTokens: 0 }, status: 'error' })
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    await settleAiQuota(quota, { model, tier: cfg.tier, latencyMs: Date.now() - started, usage: { promptTokens: 0, cachedTokens: 0, outputTokens: 0 }, status: 'error' })
    return NextResponse.json({ error: 'upstream', status: upstream.status }, { status: upstream.status === 429 ? 429 : 502 })
  }

  const stream = turnEventStream(
    upstream.body,
    { t: 'meta', chatId: quota.chatId, newChat: quota.newChat, rolled: quota.rolled, soft: quota.soft, tier: cfg.tier },
    (outcome) => {
      void settleAiQuota(quota, {
        model,
        tier: cfg.tier,
        latencyMs: Date.now() - started,
        usage: outcome.usage,
        status: outcome.status,
      })
      console.info(`[buddgy] user=${auth.userId} tier=${cfg.tier} units=${computeUnits(outcome.usage)} finish=${outcome.finish}`)
    },
  )
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  })
}
