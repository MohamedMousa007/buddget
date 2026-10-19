/**
 * POST /api/budget/ai
 *
 * Budget-specific Gemini calls with prompts, schemas and response parsing kept server-side.
 *   { op: 'build',  facts, draft }            -> { data: PlanDraft }   engine draft refined with rationale
 *   { op: 'adjust', lines, text, currency, income } -> { data: AdjustResult }
 * The model never writes anything: the client previews and applies the result.
 * Auth: Supabase session required. Per-user hourly cap shared across instances (`api_rate_hit`).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  ADJUST_SCHEMA,
  BUILD_SCHEMA,
  adjustMessages,
  applyRefinement,
  buildMessages,
  parseAdjust,
  type AdjustLine,
} from '@/lib/budget/budgetAi'
import type { BudgetFacts, PlanDraft } from '@/lib/budget/facts'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MODEL = process.env.GEMINI_MODEL_SMART?.trim() || 'gemini-2.5-flash'
const URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
// api_rate_hit prunes counters older than an hour, so the window cannot be longer.
const RATE_WINDOW_SECONDS = 3600
const RATE_MAX_HITS = 15
const MAX_BODY_CHARS = 60_000
const MAX_ADJUST_CHARS = 500

async function overQuota(userId: string): Promise<boolean> {
  const { data, error } = await createServiceRoleClient().rpc('api_rate_hit', {
    p_key: `budget-ai:${userId}`,
    p_window_seconds: RATE_WINDOW_SECONDS,
    p_max_hits: RATE_MAX_HITS,
  })
  if (error) {
    console.error('[budget/ai] rate-limit rpc failed', error.message)
    return true
  }
  return data === false
}

async function askModel(apiKey: string, system: string, user: string, schema: object, thinking: number): Promise<unknown | null> {
  try {
    const res = await fetch(`${URL_BASE}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: schema,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: thinking },
        },
      }),
    })
    if (!res.ok) return null
    const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { user } = await resolveRouteUser(req)
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
    const facts = body.facts as BudgetFacts | undefined
    const draft = body.draft as PlanDraft | undefined
    if (!facts || !draft || !Array.isArray(draft.lines)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (await overQuota(user.id)) return NextResponse.json({ error: 'Budget AI limit reached, try again later' }, { status: 429 })
    const m = buildMessages(facts, draft)
    const out = applyRefinement(draft, await askModel(apiKey, m.system, m.user, BUILD_SCHEMA, 1024))
    return out ? NextResponse.json({ data: out }) : NextResponse.json({ error: 'AI could not refine the plan' }, { status: 502 })
  }

  if (body.op === 'adjust') {
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const lines = body.lines as AdjustLine[] | undefined
    if (!text || text.length > MAX_ADJUST_CHARS || !Array.isArray(lines)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (await overQuota(user.id)) return NextResponse.json({ error: 'Budget AI limit reached, try again later' }, { status: 429 })
    const m = adjustMessages(lines, text, /^[A-Za-z]{3}$/.test(String(body.currency)) ? String(body.currency) : '', Number(body.income) || 0)
    const out = parseAdjust(await askModel(apiKey, m.system, m.user, ADJUST_SCHEMA, 512))
    return out ? NextResponse.json({ data: out }) : NextResponse.json({ error: 'AI could not read that' }, { status: 502 })
  }

  return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
}
