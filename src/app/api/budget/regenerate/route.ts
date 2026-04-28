import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  AI_UNAVAILABLE_MANUAL_SETUP_MESSAGE,
  SYSTEM_RESTING_MESSAGE,
  generateWithFallbackFromRequest,
  throwIfAiProxyNotOk,
} from '@/lib/ai/generateWithFallback'
import { convertCurrency } from '@/lib/utils/currency'
import type { OnboardingDraft } from '@/lib/onboarding/onboardingDraft'
import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import {
  REGENERATE_CATEGORY_KEYS,
  type RegenerateCategoryKey,
} from '@/lib/budget/mergeRegeneratedCategories'

function monthlyIncomeFromOnboardingDraft(draft: OnboardingDraft): number {
  const base = draft.baseCurrency
  return draft.incomeSources
    .filter((i) => i.isRecurring && i.amount > 0)
    .reduce((s, i) => s + convertCurrency(i.amount, i.currency, base, {}), 0)
}

function fixedCostsTotalFromDraft(draft: OnboardingDraft): number {
  return draft.fixedCosts.reduce((s, f) => s + (f.amount > 0 ? f.amount : 0), 0)
}

function stripJsonObjectFromMarkdown(text: string): string {
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/g, '').trim()
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

function parseBudgetRows(raw: unknown): BudgetCategoryRow[] | null {
  if (!Array.isArray(raw)) return null
  const out: BudgetCategoryRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const o = item as Record<string, unknown>
    if (typeof o.name !== 'string' || typeof o.amount !== 'number') return null
    out.push({
      name: o.name.trim(),
      emoji: typeof o.emoji === 'string' && o.emoji.trim() ? o.emoji.trim() : '📌',
      amount: Math.max(0, Math.round(o.amount)),
      currency: typeof o.currency === 'string' ? o.currency : 'AED',
    })
  }
  return out.length ? out : null
}

function normalizeAiCategories(raw: unknown): Partial<Record<RegenerateCategoryKey, number>> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: Partial<Record<RegenerateCategoryKey, number>> = {}
  for (const k of REGENERATE_CATEGORY_KEYS) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = Math.max(0, Math.round(v))
    }
  }
  return out
}

function enforceCategoryCap(
  cats: Partial<Record<RegenerateCategoryKey, number>>,
  cap: number,
): Record<RegenerateCategoryKey, number> {
  const full = {} as Record<RegenerateCategoryKey, number>
  let sum = 0
  for (const k of REGENERATE_CATEGORY_KEYS) {
    full[k] = cats[k] ?? 0
    sum += full[k]
  }
  if (cap < 0) {
    for (const k of REGENERATE_CATEGORY_KEYS) full[k] = 0
    return full
  }
  if (sum <= cap || sum <= 0) return full
  const scale = cap / sum
  const rounded: Record<RegenerateCategoryKey, number> = {} as Record<RegenerateCategoryKey, number>
  let assigned = 0
  for (let i = 0; i < REGENERATE_CATEGORY_KEYS.length; i++) {
    const k = REGENERATE_CATEGORY_KEYS[i]!
    const v = full[k]
    if (i === REGENERATE_CATEGORY_KEYS.length - 1) {
      rounded[k] = Math.max(0, cap - assigned)
    } else {
      const n = Math.max(0, Math.round(v * scale))
      rounded[k] = n
      assigned += n
    }
  }
  return rounded
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      feedbackText?: unknown
      currentBudget?: unknown
      onboardingDraft?: unknown
    }

    const feedbackText =
      typeof body.feedbackText === 'string' ? body.feedbackText.trim() : ''
    const currentBudget = parseBudgetRows(body.currentBudget)
    const onboardingDraft =
      body.onboardingDraft && typeof body.onboardingDraft === 'object' ?
        (body.onboardingDraft as OnboardingDraft)
      : null

    if (!feedbackText || !currentBudget?.length || !onboardingDraft) {
      return NextResponse.json(
        { error: 'Invalid body: feedbackText, currentBudget[], onboardingDraft required' },
        { status: 400 },
      )
    }

    const { data: priorRows, error: priorErr } = await supabase
      .from('budget_feedback')
      .select('feedback_text')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (priorErr) {
      console.error('[budget/regenerate] prior feedback', priorErr.message)
      return NextResponse.json({ error: 'Could not load feedback history' }, { status: 500 })
    }

    const previousFeedback = priorRows ?? []
    const totalIncome = Math.round(monthlyIncomeFromOnboardingDraft(onboardingDraft))
    const fixedCostsTotal = Math.round(fixedCostsTotalFromDraft(onboardingDraft))
    const baseCurrency = onboardingDraft.baseCurrency
    const budgetStyle = onboardingDraft.budgetStyle
    const country = onboardingDraft.country

    const prompt = `
    You are a personal finance advisor helping a user set up their 
    monthly budget. 
    
    Their financial profile:
    - Monthly income: ${totalIncome} ${baseCurrency}
    - Fixed costs: ${fixedCostsTotal} ${baseCurrency}
    - Budget style: ${budgetStyle}
    - Country: ${country}
    
    Current budget plan:
    ${JSON.stringify(currentBudget, null, 2)}
    
    User feedback: "${feedbackText}"
    
    Previous feedback history:
    ${previousFeedback.map((f) => `- "${f.feedback_text}"`).join('\n')}
    
    Return ONLY a JSON object with updated budget amounts:
    {
      "categories": {
        "Rent": number,
        "Transport": number,
        "Food": number,
        "Enjoyment": number,
        "Savings": number,
        "Debt": number,
        "Remittance": number,
        "Other": number
      },
      "explanation": "one sentence why you made these changes"
    }
    
    Rules:
    - Total of all categories must not exceed (income - fixedCosts)
    - Respect the user's budget style preference
    - Learn from previous feedback — don't repeat rejected plans
    - Keep amounts as whole numbers
  `.trim()

    const contents = [{ role: 'user', parts: [{ text: prompt }] }]
    const aiResponse = await generateWithFallbackFromRequest(req, {
      contents,
      generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
    })

    await throwIfAiProxyNotOk(aiResponse)
    const result = await aiResponse.json()
    const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonStr = stripJsonObjectFromMarkdown(text)

    let parsed: { categories?: unknown; explanation?: unknown }
    try {
      parsed = JSON.parse(jsonStr) as { categories?: unknown; explanation?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })
    }

    const rawCats = normalizeAiCategories(parsed.categories)
    if (!rawCats) {
      return NextResponse.json({ error: 'Invalid AI categories' }, { status: 502 })
    }

    const cap = totalIncome - fixedCostsTotal
    const categories = enforceCategoryCap(rawCats, cap)
    const explanation =
      typeof parsed.explanation === 'string' && parsed.explanation.trim() ?
        parsed.explanation.trim()
      : 'Adjusted your categories based on your feedback.'

    const { error: insErr } = await supabase.from('budget_feedback').insert({
      user_id: user.id,
      feedback_text: feedbackText,
      budget_before: currentBudget,
      budget_after: categories,
    })

    if (insErr) {
      console.error('[budget/regenerate] insert', insErr.message)
      return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 })
    }

    return NextResponse.json({ categories, explanation })
  } catch (e) {
    console.error('[budget/regenerate]', e)
    const msg = e instanceof Error ? e.message : 'Failed to regenerate'
    if (msg === SYSTEM_RESTING_MESSAGE) {
      return NextResponse.json({ error: msg }, { status: 429 })
    }
    if (msg === AI_UNAVAILABLE_MANUAL_SETUP_MESSAGE) {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
