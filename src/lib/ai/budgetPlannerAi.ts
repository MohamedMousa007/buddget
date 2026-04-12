import { z } from 'zod'
import type { BudgetPlan, Currency } from '@/lib/store/types'
import type { BudgetPlannerContextPayload } from '@/lib/ai/buddgyBudgetPlannerPrompt'
import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import {
  effectivePlanCategoryAmount,
  effectivePlanCategoryAmountInBase,
  isSavingsPlanCategory,
  planCategoryCurrency,
  totalPlannedExpensesForPlan,
  totalPlannedSavingsAllocationForPlan,
} from '@/lib/budget/budgetPlans'
import { parseModelJsonToAIResponse, type AIResponse } from '@/lib/ai/gemini'

const EVAL_RATINGS = ['Realistic', 'Tight', 'Needs Adjustment', 'Unrealistic'] as const
export type BudgetPlanEvalRating = (typeof EVAL_RATINGS)[number]

const evalSchema = z.object({
  rating: z.string(),
  explanation: z.string(),
})

export interface BudgetPlanEvalResult {
  rating: BudgetPlanEvalRating
  explanation: string
}

function normalizeRating(raw: string): BudgetPlanEvalRating {
  const t = raw.trim()
  if (EVAL_RATINGS.includes(t as BudgetPlanEvalRating)) return t as BudgetPlanEvalRating
  const lower = t.toLowerCase()
  if (lower.includes('unreal')) return 'Unrealistic'
  if (lower.includes('tight')) return 'Tight'
  if (lower.includes('adjust') || lower.includes('risk') || lower.includes('exceed')) return 'Needs Adjustment'
  return 'Realistic'
}

const EVAL_PARSE_FALLBACK =
  'We could not read Buddgy reply in the expected format. Try again in a moment.'

/** Serializable snapshot for prompts (ids preserved for AI apply actions). */
export function buildPlanRowsForPrompt(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): string {
  const rows = plan.categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    icon: c.icon,
    isSavings: isSavingsPlanCategory(c),
    rowCurrency: planCategoryCurrency(c, baseCurrency),
    amountIfNoSubs: c.amount,
    subcategories: c.subcategories.map((s) => ({
      subcategoryId: s.id,
      name: s.name,
      amount: s.amount,
    })),
    effectiveTotalInRowCurrency: effectivePlanCategoryAmount(c),
    effectiveTotalInBase: effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates),
  }))
  return JSON.stringify(rows, null, 2)
}

export function buildBudgetPlannerContextBlock(
  plan: BudgetPlan,
  totalMonthlyIncome: number,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): string {
  const plannedExpenses = totalPlannedExpensesForPlan(plan, baseCurrency, exchangeRates)
  const plannedSavingsAlloc = totalPlannedSavingsAllocationForPlan(plan, baseCurrency, exchangeRates)
  const projectedSavings = totalMonthlyIncome - plannedExpenses
  return [
    `BASE_CURRENCY: ${baseCurrency}`,
    `PLAN_ID: ${plan.id}`,
    `PLAN_NAME: ${plan.name}`,
    `TOTAL_MONTHLY_INCOME (estimated, base currency): ${totalMonthlyIncome}`,
    `TOTAL_PLANNED_EXPENSES (expense categories only, base currency): ${plannedExpenses}`,
    `PLANNED_SAVINGS_ALLOCATION (savings rows, base currency): ${plannedSavingsAlloc}`,
    `PROJECTED_SAVINGS (income - planned expenses): ${projectedSavings}`,
    'PLAN_ROWS_JSON:',
    buildPlanRowsForPrompt(plan, baseCurrency, exchangeRates),
  ].join('\n')
}

export async function evaluateBudgetPlanWithAi(contextBlock: string): Promise<BudgetPlanEvalResult> {
  const instruction = `You are Buddgy. Read the user's monthly budget plan (JSON below) and monthly income.

${contextBlock}

Return ONLY a single JSON object, no markdown, no code fences:
{"rating":"Realistic"|"Tight"|"Needs Adjustment"|"Unrealistic","explanation":"2-3 short sentences in plain language"}

- Realistic: plan fits typical spending and leaves reasonable margin.
- Tight: little room for surprises; high risk of overspending.
- Needs Adjustment: some categories or totals look off but might be fixable with tweaks.
- Unrealistic: planned expenses clearly exceed income or allocations are impossible.`

  const contents = [
    { role: 'user', parts: [{ text: instruction }] },
  ]

  const response = await generateWithFallback({
    contents,
    generationConfig: { temperature: 0.35, maxOutputTokens: 512 },
  })
  await throwIfAiProxyNotOk(response)
  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    return { rating: 'Realistic', explanation: 'Could not load an evaluation right now.' }
  }
  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  }
  try {
    const parsed = evalSchema.safeParse(JSON.parse(jsonStr))
    if (!parsed.success) {
      return { rating: 'Realistic', explanation: EVAL_PARSE_FALLBACK }
    }
    return {
      rating: normalizeRating(parsed.data.rating),
      explanation: parsed.data.explanation.trim() || 'No details.',
    }
  } catch {
    return { rating: 'Realistic', explanation: EVAL_PARSE_FALLBACK }
  }
}

const CHAT_BOOT = `{"action":"query","data":{},"confidence":1,"clarificationNeeded":null,"message":"I'm Buddgy — here to help tune your budget. When I suggest new amounts, I'll use action update_budget_plan_row with planId, categoryId, and newAmount (number in base currency). Clearing subcategories is implied when you set a new top-level amount."}`

/**
 * Budget Planner chat: same proxy as main AI; system prompt carries full plan context.
 */
export async function sendBudgetPlannerChat(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<AIResponse> {
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: CHAT_BOOT }] },
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  const response = await generateWithFallback({
    contents,
    generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
  })
  await throwIfAiProxyNotOk(response)
  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from AI')
  return parseModelJsonToAIResponse(text, text)
}

export interface BuddgyPlannerThreadMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Buddgy plan builder: Gemini gets systemInstruction from `/api/ai` + multi-turn contents (opener as first model turn).
 */
export async function sendBuddgyPlanBuilderChat(params: {
  openerText: string
  thread: BuddgyPlannerThreadMessage[]
  contextPayload: BudgetPlannerContextPayload
}): Promise<AIResponse> {
  const contents: { role: string; parts: { text: string }[] }[] = [
    { role: 'model', parts: [{ text: params.openerText }] },
  ]
  for (let i = 1; i < params.thread.length; i++) {
    const m = params.thread[i]
    contents.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })
  }

  const response = await generateWithFallback({
    contents,
    generationConfig: { temperature: 0.45, maxOutputTokens: 2048 },
    mode: 'budget-planner',
    budgetPlannerContext: params.contextPayload,
  })
  await throwIfAiProxyNotOk(response)
  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from AI')
  return parseModelJsonToAIResponse(text, text)
}

export function buildBudgetPlannerChatSystemPrompt(contextBlock: string): string {
  return `You are Buddgy on the Budget Planner page. Help the user adjust category amounts, suggest cuts, evaluate realism, and explain projections.

RULES:
1. ALWAYS return a single valid JSON object (same schema as main Buddget AI). No markdown outside JSON.
2. Use action "query" with a helpful message when no store change is needed.
3. When suggesting a concrete new budget for a TOP-LEVEL category, use action "update_budget_plan_row" with:
   data.planId (string), data.categoryId (string), data.newAmount (number, base currency).
   This replaces the category's amount and clears its subcategories so the total equals newAmount.
4. Use ONLY categoryId values from PLAN_ROWS_JSON in the context. Never invent ids.
5. You may include multiple actions in an "actions" array if the user asks for several changes.
6. Amounts in update_budget_plan_row are always in BASE_CURRENCY from the context; the store will set the row currency to base when applied.

CONTEXT:
${contextBlock}

Other actions (add_expense, etc.) are not the focus here; prefer update_budget_plan_row or query.`
}
