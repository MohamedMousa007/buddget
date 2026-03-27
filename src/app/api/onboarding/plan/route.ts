import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeCategoryPercents } from '@/lib/onboarding/planNormalization'
import {
  ONBOARDING_PERSONA_PRESETS,
  personaPromptBlock,
  isValidPersonaId,
} from '@/lib/onboarding/personas'
import type { OnboardingAiPlan } from '@/lib/store/types'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function supabaseAuthConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}

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

const requestSchema = z.object({
  country: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  currency: z.string().min(3).max(5),
  monthlyTakeHome: z.number().min(0).max(1_000_000_000),
  answers: z.record(z.string(), z.unknown()).optional(),
})

const planRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  personaId: z.string(),
  rationale: z.string(),
  costOfLivingNote: z.string().optional(),
  percents: z.record(z.string(), z.number()),
  assumptions: z.array(z.string()).default([]),
})

const responseSchema = z.object({
  validationNotes: z.array(z.string()).default([]),
  plans: z.array(planRowSchema).min(1).max(5),
})

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

function enrichPersona(p: z.infer<typeof planRowSchema>): OnboardingAiPlan {
  const pid = isValidPersonaId(p.personaId) ? p.personaId : 'steady_navigator'
  const preset = ONBOARDING_PERSONA_PRESETS.find((x) => x.id === pid) ?? ONBOARDING_PERSONA_PRESETS[0]
  return {
    id: p.id,
    label: p.label,
    personaId: pid,
    personaLabel: preset.label,
    personaTagline: preset.tagline,
    rationale: truncate(p.rationale, 220),
    costOfLivingNote: p.costOfLivingNote ? truncate(p.costOfLivingNote, 120) : undefined,
    percents: normalizeCategoryPercents(p.percents),
    assumptions: p.assumptions.slice(0, 2).map((a) => truncate(a, 100)),
  }
}

function buildPrompt(body: z.infer<typeof requestSchema>): string {
  const answersJson = JSON.stringify(body.answers ?? {}, null, 2)
  return `You are a careful budgeting assistant (not a licensed financial advisor). Use Google Search to find RECENT typical cost-of-living hints for ${body.city}, ${body.country} — especially rent/housing, food, and transport — stated in or convertible to ${body.currency}. If search results conflict, prefer official or widely cited ranges and say you are approximating.

User monthly take-home (same currency): ${body.monthlyTakeHome}
Structured survey answers (JSON):
${answersJson}

TASK:
1) If something is clearly inconsistent (e.g. housing vs income), add at most ONE short line in "validationNotes" (or leave empty). No essays.
2) Propose EXACTLY THREE different monthly budget allocation plans as PERCENTAGES of monthly take-home across categories: Rent, Transport, Food, Enjoyment, Savings, Debt, Remittance, Other. Each plan must sum to 100 (±0.5 before rounding).
3) Plans should reflect: (A) balanced real life, (B) stronger alignment with their stated goals, (C) either more savings stability OR more aggressive debt paydown depending on their answers — make C meaningfully different from A and B.
4) Assign each plan a personaId from this FIXED list only:
${personaPromptBlock()}

Tone: friendly and human — NOT long AI prose. Keep copy tight.

OUTPUT: Single JSON object only, no markdown:
{
  "validationNotes": string[] (0–1 short items, each under 120 chars),
  "plans": [
    {
      "id": "plan_a",
      "label": "short title",
      "personaId": "one_of_the_ids_above",
      "rationale": "at most 2 short sentences",
      "costOfLivingNote": "optional — one short sentence or omit",
      "percents": { "Rent": number, "Transport": number, ... },
      "assumptions": string[] (max 2 items, each under 90 chars)
    },
    ... exactly 3 objects ...
  ]
}`
}

function extractJsonObject(text: string): string {
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```json?\n?/i, '').replace(/```\s*$/i, '').trim()
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

function fallbackPlans(currency: string): OnboardingAiPlan[] {
  const mk = (
    id: string,
    label: string,
    personaId: (typeof ONBOARDING_PERSONA_PRESETS)[number]['id'],
    rationale: string,
    percents: Record<string, number>
  ): OnboardingAiPlan => {
    const preset = ONBOARDING_PERSONA_PRESETS.find((p) => p.id === personaId)!
    return {
      id,
      label,
      personaId,
      personaLabel: preset.label,
      personaTagline: preset.tagline,
      rationale,
      costOfLivingNote: `Approximate defaults in ${currency} — AI was unavailable; adjust in Settings.`,
      percents: normalizeCategoryPercents(percents),
      assumptions: ['Generated offline because the AI service did not return a valid plan.'],
    }
  }
  return [
    mk(
      'plan_a',
      'Balanced baseline',
      'steady_navigator',
      'Even spread between needs, lifestyle, and future.',
      { Rent: 28, Transport: 10, Food: 18, Enjoyment: 8, Savings: 14, Debt: 12, Remittance: 5, Other: 5 }
    ),
    mk(
      'plan_b',
      'Goals-forward',
      'goal_accelerator',
      'Pushes savings and goal progress while keeping essentials.',
      { Rent: 26, Transport: 9, Food: 16, Enjoyment: 6, Savings: 22, Debt: 12, Remittance: 5, Other: 4 }
    ),
    mk(
      'plan_c',
      'Stability & essentials',
      'essentialist',
      'Prioritizes housing, food, and transport; trims discretionary.',
      { Rent: 32, Transport: 11, Food: 20, Enjoyment: 4, Savings: 10, Debt: 10, Remittance: 8, Other: 5 }
    ),
  ]
}

export async function POST(req: Request) {
  const authDenied = await requireUserOrUnauthorized()
  if (authDenied) return authDenied

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    const body = requestSchema.safeParse(await req.json().catch(() => null))
    const cur = body.success ? body.data.currency : 'USD'
    return NextResponse.json({
      validationNotes: ['AI is not configured — showing template plans.'],
      plans: fallbackPlans(cur),
    })
  }

  let jsonBody: unknown
  try {
    jsonBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(jsonBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const userParts = buildPrompt(parsed.data)
  const contents = [{ parts: [{ text: userParts }] }]

  const tryGenerate = async (withSearch: boolean) => {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 8192,
      },
    }
    if (withSearch) {
      body.tools = [{ google_search: {} }]
    }
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await res.json()
    return { res, payload }
  }

  let { res, payload } = await tryGenerate(true)
  if (!res.ok) {
    const errMsg = payload?.error?.message || ''
    const retryWithout =
      res.status === 400 && typeof errMsg === 'string' && errMsg.toLowerCase().includes('tool')
    if (retryWithout) {
      ;({ res, payload } = await tryGenerate(false))
    }
  }

  if (!res.ok) {
    console.error('[onboarding/plan] Gemini error', payload?.error?.message)
    return NextResponse.json({
      validationNotes: [payload?.error?.message || 'AI request failed — template plans shown.'],
      plans: fallbackPlans(parsed.data.currency),
    })
  }

  const text = payload?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text as
    | string
    | undefined

  if (!text) {
    return NextResponse.json({
      validationNotes: ['Empty AI response — template plans shown.'],
      plans: fallbackPlans(parsed.data.currency),
    })
  }

  let obj: unknown
  try {
    obj = JSON.parse(extractJsonObject(text))
  } catch {
    return NextResponse.json({
      validationNotes: ['Could not parse AI JSON — template plans shown.'],
      plans: fallbackPlans(parsed.data.currency),
    })
  }

  const zResult = responseSchema.safeParse(obj)
  if (!zResult.success || zResult.data.plans.length !== 3) {
    return NextResponse.json({
      validationNotes: ['AI returned an invalid shape — template plans shown.'],
      plans: fallbackPlans(parsed.data.currency),
    })
  }

  const plans: OnboardingAiPlan[] = zResult.data.plans.slice(0, 3).map((p) => enrichPersona(p))

  const notes = zResult.data.validationNotes
    .map((n) => truncate(n, 120))
    .filter(Boolean)
    .slice(0, 1)

  return NextResponse.json({
    validationNotes: notes,
    plans,
  })
}
