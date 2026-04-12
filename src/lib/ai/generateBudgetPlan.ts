import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'

export interface GeneratedPlan {
  categories: BudgetCategoryRow[]
  summary: {
    totalExpenses: number
    totalSavings: number
    buffer: number
    savingsRate: number
  }
  tip: string
}

/**
 * Generate a polished budget plan from structured user data.
 * Single API call (~400 input tokens, ~300 output tokens).
 */
export async function generateBudgetPlan(params: {
  income: number
  currency: string
  city: string
  household: string
  rent: number
  rentIncludesUtilities: boolean
  groceries: number
  dining: number
  transport: number
  transportMode: string
  entertainmentTotal: number
  savingsAmount: number
  bufferAmount: number
  lifestyleNotes: string | null
  categories: BudgetCategoryRow[]
}): Promise<GeneratedPlan> {
  const totalExpenses = params.categories.reduce((s, c) => s + c.amount, 0)
  const savingsRate = params.income > 0 ? Math.round((params.savingsAmount / params.income) * 100) : 0

  const systemPrompt = `You are Buddgy, a financial advisor for the Buddget app.
Generate a budget plan summary. Take the pre-computed categories and add a short motivational tip.

User data:
- Income: ${params.income} ${params.currency}/month
- City: ${params.city}, Household: ${params.household}
- Total expenses: ${totalExpenses} ${params.currency}
- Savings: ${params.savingsAmount} ${params.currency}
- Buffer: ${params.bufferAmount} ${params.currency}
- Savings rate: ${savingsRate}%
- User's goal: "${params.lifestyleNotes || 'not specified'}"

Respond with ONLY this JSON, nothing else:
{
  "tip": "One short motivational sentence about their plan, max 15 words, no emoji, no markdown"
}

Rules:
- The tip should be encouraging and personal
- Reference their savings rate or specific situation
- Never start with "That's" or "Great!"
- Max 15 words`

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
  ]

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
      categories: params.categories,
      summary: {
        totalExpenses,
        totalSavings: params.savingsAmount,
        buffer: params.bufferAmount,
        savingsRate,
      },
      tip: parsed.tip || fallbackTip(savingsRate),
    }
  } catch {
    return {
      categories: params.categories,
      summary: {
        totalExpenses,
        totalSavings: params.savingsAmount,
        buffer: params.bufferAmount,
        savingsRate,
      },
      tip: fallbackTip(savingsRate),
    }
  }
}

function fallbackTip(savingsRate: number): string {
  if (savingsRate >= 40) return "You're ahead of most people who never even set a budget."
  if (savingsRate >= 20) return 'A solid start — consistency will make this compound.'
  return 'Every budget is a step forward. You can adjust anytime.'
}
