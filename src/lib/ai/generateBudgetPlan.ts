import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import { isSavingsCategoryRow, type BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'

export interface GeneratedPlan {
  categories: BudgetCategoryRow[]
  summary: {
    totalExpenses: number
    /** Income minus planned expenses (not a budget row). */
    projectedSavings: number
    savingsRate: number
  }
  tip: string
}

function stripJsonFromMarkdown(text: string): string {
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/g, '').trim()
  }
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

/**
 * Short motivational line after the plan is finalized (expense categories only).
 */
export async function generateBudgetPlan(params: {
  income: number
  currency: string
  city: string
  household: string
  lifestyleNotes: string | null
  categories: BudgetCategoryRow[]
}): Promise<GeneratedPlan> {
  const expenseOnly = params.categories.filter((c) => !isSavingsCategoryRow(c))
  const totalExpenses = expenseOnly.reduce((s, c) => s + c.amount, 0)
  const projectedSavings = params.income - totalExpenses
  const savingsRate =
    params.income > 0 ? Math.round((Math.max(0, projectedSavings) / params.income) * 100) : 0

  const systemPrompt = `You are Buddgy, a financial advisor for the Buddget app.
Generate one short motivational tip. The plan has ONLY expense categories — no Savings category row.
Projected savings = income minus those expenses (${projectedSavings} ${params.currency}/month, ~${savingsRate}% of income).

User data:
- Income: ${params.income} ${params.currency}/month
- City: ${params.city}, Household: ${params.household}
- Total planned expenses: ${totalExpenses} ${params.currency}
- Projected savings: ${projectedSavings} ${params.currency}
- Notes: "${params.lifestyleNotes || 'not specified'}"

Respond with ONLY this JSON, nothing else:
{
  "tip": "One short motivational sentence, max 15 words, no emoji, no markdown"
}

Rules:
- Encourage without sounding generic
- Never start with "That's" or "Great!"
- Max 15 words`

  const contents = [{ role: 'user', parts: [{ text: systemPrompt }] }]

  try {
    const response = await generateWithFallback({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
    })
    await throwIfAiProxyNotOk(response)
    const result = await response.json()
    const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const parsed = JSON.parse(jsonStr) as { tip: string }
    return {
      categories: expenseOnly,
      summary: {
        totalExpenses,
        projectedSavings,
        savingsRate,
      },
      tip: parsed.tip || fallbackTip(savingsRate),
    }
  } catch {
    return {
      categories: expenseOnly,
      summary: {
        totalExpenses,
        projectedSavings,
        savingsRate,
      },
      tip: fallbackTip(savingsRate),
    }
  }
}

/**
 * Adjust category amounts from natural-language feedback (full AI pass).
 */
export async function regenerateBudgetPlanWithAi(params: {
  categories: BudgetCategoryRow[]
  income: number
  currency: string
  city: string
  household: string
  feedback: string
}): Promise<BudgetCategoryRow[]> {
  const expenseOnly = params.categories.filter((c) => !isSavingsCategoryRow(c))
  const planJson = JSON.stringify(
    expenseOnly.map((c) => ({
      name: c.name,
      emoji: c.emoji,
      amount: c.amount,
      currency: c.currency,
    }))
  )

  const systemPrompt = `You are adjusting a budget plan based on user feedback.

Current plan (expense categories only — never add a "Savings" row):
${planJson}

User income: ${params.income} ${params.currency}/month
City: ${params.city}
Household: ${params.household}

User feedback: "${params.feedback}"

Adjust amounts to reflect the feedback. Keep the same category names and order where possible; you may tweak emojis slightly. Total expenses should not exceed income. If feedback asks for lower rent, note that rent is fixed from user input — still return Rent with the same amount unless feedback explicitly asks to reduce rent number.

Respond with ONLY a JSON array, no markdown:
[{"name":"Rent","emoji":"🏠","amount":5000,"currency":"${params.currency}"},...]

Every object must have name, emoji, amount (number), currency ("${params.currency}").`

  const contents = [{ role: 'user', parts: [{ text: systemPrompt }] }]

  const response = await generateWithFallback({
    contents,
    generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
  })
  await throwIfAiProxyNotOk(response)
  const result = await response.json()
  const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  const jsonStr = stripJsonFromMarkdown(text)
  const parsed = JSON.parse(jsonStr) as Array<{
    name: string
    emoji?: string
    amount: number
    currency?: string
  }>

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Invalid AI plan shape')
  }

  return parsed
    .filter((r) => r && typeof r.name === 'string' && String(r.name).trim().toLowerCase() !== 'savings')
    .map((r) => ({
      name: String(r.name).trim(),
      emoji: typeof r.emoji === 'string' && r.emoji.trim() ? r.emoji.trim() : '📌',
      amount: Math.max(0, Math.round(Number(r.amount) || 0)),
      currency: typeof r.currency === 'string' ? r.currency : params.currency,
    }))
}

function fallbackTip(savingsRate: number): string {
  if (savingsRate >= 40) return "You're ahead of most people who never even set a budget."
  if (savingsRate >= 20) return 'A solid start — consistency will make this compound.'
  return 'Every budget is a step forward. You can adjust anytime.'
}
