import type { BudgetHousehold } from '@/lib/store/types'

export interface BuddgyFillContextPayload {
  city: string
  country: string
  alreadySetLines: string
  remainingBudget: number
  currency: string
  household: BudgetHousehold
}

/**
 * System instruction for Gemini: fill remaining budget categories (JSON array only).
 */
export function buildBuddgyFillSystemPrompt(ctx: BuddgyFillContextPayload): string {
  const householdLabel =
    ctx.household === 'solo' ? 'just me' : ctx.household === 'partner' ? 'me + partner' : 'family'

  return `You are Buddgy, budget assistant for the Buddget app.
Generate remaining budget categories for a user in ${ctx.city}, ${ctx.country}.

Already set by user:
${ctx.alreadySetLines}

Remaining monthly budget: ${ctx.remainingBudget} ${ctx.currency}
Household: ${householdLabel}

Respond with ONLY a JSON array, no explanation, no markdown:
[{"name":"Groceries","emoji":"🛒","amount":1500,"currency":"${ctx.currency}"}, ...]

Rules:
- Fill only categories not already set by the user
- Amounts must sum to less than or equal to the remaining budget
- Use realistic averages for the user's city
- Include 4-7 categories max
- Category names: short, no emoji in the name (emoji is separate field)
- For UAE: consider groceries, dining, phone, personal care, entertainment, subscriptions
- If household includes partner or family, scale food and personal care up`
}
