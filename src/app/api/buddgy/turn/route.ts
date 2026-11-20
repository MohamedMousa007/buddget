import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { SPEC_BY_NAME, ALL_SPECS } from '@/lib/buddgy/tools/specs'
import { toGeminiDeclaration } from '@/lib/buddgy/tools/spec'
import { requireAiUser } from '@/lib/server/ai/auth'
import { callGeminiResilient, thinkingMode, TIER_MODELS } from '@/lib/server/ai/gemini'
import { INTENT_CONFIG, SYSTEM_PROMPT } from '@/lib/server/ai/buddgy/prompt'
import { advisorGate } from '@/lib/server/ai/buddgy/advisor'
import { FREE_ADVISOR_THINKING_BUDGET, MAX_HOPS, hopsDone, resolveAdvisor, trimContext } from '@/lib/server/ai/buddgy/plan'
import { billingEnabled } from '@/lib/entitlements/billingSwitch'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { buildContents, turnEventStream } from '@/lib/server/ai/buddgy/turn'
import { parseTurnRequest } from '@/lib/server/ai/buddgy/validate'
import { tooLargeByHeader } from '@/lib/server/ai/bodyLimit'
import { quotaDeniedResponse, reserveAiQuota, settleAiQuota } from '@/lib/server/ai/quota'
import { computeUnits, estimateUnits } from '@/lib/server/ai/units'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** A turn is capped at ~24k chars of messages plus signatures; this is the byte ceiling before it is read. */
const MAX_BODY_BYTES = 256 * 1024
const KNOWN_TOOLS: ReadonlySet<string> = new Set(SPEC_BY_NAME.keys())

export async function POST(req: Request) {
  const outdated = await gateOutdatedClient(req)
  if (outdated) return outdated
  const started = Date.now()
  const auth = await requireAiUser(req)
  if ('denied' in auth) return auth.denied

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const tooLarge = tooLargeByHeader(req, MAX_BODY_BYTES)
  if (tooLarge) return tooLarge

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const parsed = parseTurnRequest(raw, KNOWN_TOOLS)
  if (!parsed.ok) return NextResponse.json({ error: 'bad_request', reason: parsed.reason }, { status: 400 })
  const turn = parsed.value

  // The Advisor (the smart tier, an `advice` turn) is Pro; a plan without it gets one free answer a month, then the fast tier.
  const advisor = resolveAdvisor(turn.intent ?? 'answer', turn.intent === 'advice' ? await advisorGate(auth.userId) : null)
  const baseCfg = INTENT_CONFIG[advisor.intent]
  const cfg = advisor.mode === 'free' ? { ...baseCfg, thinkingBudget: Math.min(baseCfg.thinkingBudget, FREE_ADVISOR_THINKING_BUDGET) } : baseCfg
  const model = TIER_MODELS[cfg.tier]

  // Tool hops per turn: 2 on Free while selling is on, 3 otherwise.
  const service = createServiceRoleClient()
  const free = (await billingEnabled(service)) && (await getUserEntitlements(service, auth.userId)).planKey === 'free'
  const maxHops = free ? MAX_HOPS.free : MAX_HOPS.pro
  if (hopsDone(turn.messages) > maxHops) return NextResponse.json({ error: 'bad_request', reason: 'hops' }, { status: 400 })

  const sent = { ...turn, context: trimContext(turn.context, advisor.intent) }
  const contents = buildContents(sent)

  const quota = await reserveAiQuota({
    userId: auth.userId,
    feature: turn.hop ? 'chat_hop' : 'chat',
    chatId: turn.chatId ?? null,
    advisorFree: advisor.mode === 'free',
    turnId: turn.turnId,
    estUnits: estimateUnits(JSON.stringify(contents).length + SYSTEM_PROMPT.length, cfg.maxOutputTokens),
  })
  if (!quota.allowed) return quotaDeniedResponse(quota)

  let usedModel = model
  const estInputTokens = Math.ceil((JSON.stringify(contents).length + SYSTEM_PROMPT.length) / 4)
  const settleFailed = () =>
    settleAiQuota(quota, { model: usedModel, tier: cfg.tier, latencyMs: Date.now() - started, usage: { promptTokens: 0, cachedTokens: 0, outputTokens: 0 }, status: 'error' })

  let upstream: Response
  try {
    // Always the full list in its fixed order: with the system prompt it is the cacheable prefix (cached tokens cost a tenth).
    const tools = ALL_SPECS.filter((t) => !quota.disabled.includes(`tool:${t.domain}`))
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
    const other = cfg.tier === 'fast' ? TIER_MODELS.smart : TIER_MODELS.fast
    const called = await callGeminiResilient(other === model ? [model] : [model, other], apiKey, body, req.signal)
    upstream = called.res
    usedModel = called.model
  } catch {
    await settleFailed()
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    await settleFailed()
    return NextResponse.json({ error: 'upstream', status: upstream.status }, { status: upstream.status === 429 ? 429 : 502 })
  }

  const stream = turnEventStream(
    upstream.body,
    // `soft` is always false: passing the spend line used to cut the history sent to 2 items and show "this chat is
    // getting long" (BDG-013). Sent from the server so builds already installed stop forgetting too.
    { t: 'meta', chatId: quota.chatId, newChat: quota.newChat, rolled: quota.rolled, soft: false, tier: cfg.tier, mode: thinkingMode(cfg.thinkingBudget), maxHops, ...(advisor.mode === 'free' || advisor.mode === 'locked' ? { advisor: advisor.mode } : {}) },
    async (outcome) => {
      // An abort before Gemini reported usage still consumed the prompt: log its cost. Whether it is charged is the
      // status's call (0337): `aborted` (text reached the user) is, `aborted_empty` is not.
      const cut = outcome.status === 'aborted' || outcome.status === 'aborted_empty'
      const usage = outcome.usage.promptTokens === 0 && cut ? { ...outcome.usage, promptTokens: estInputTokens } : outcome.usage
      // One user message is charged as one turn (0338). A tool step is a call that asks the phone for data while hops
      // are left (the phone answers and calls again); text, a proposal or a navigation is what the user sees.
      const kinds = outcome.calls.map((name) => SPEC_BY_NAME.get(name)?.kind)
      const provisional = outcome.status === 'ok' && kinds.some((k) => k === 'read' || k === undefined) && hopsDone(turn.messages) < maxHops
      const visible = outcome.textChars > 0 || kinds.some((k) => k === 'write' || k === 'nav')
      await settleAiQuota(quota, {
        model: usedModel,
        tier: cfg.tier,
        latencyMs: Date.now() - started,
        usage,
        status: outcome.status,
        ...(turn.turnId ? { provisional, visible } : {}),
      })
      console.info(`[buddgy] user=${auth.userId} tier=${cfg.tier} units=${computeUnits(usage)} finish=${outcome.finish}`)
    },
  )
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  })
}
