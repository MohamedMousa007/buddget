import { z } from 'zod'
import type { Currency, PaymentMethod, Debt, IncomeSource, SavingsAccount } from '@/lib/store/types'
import {
  generateWithFallback,
  throwIfAiProxyNotOk,
} from '@/lib/ai/generateWithFallback'

export type AIAction =
  | 'add_expense'
  | 'update_expense'
  | 'delete_expense'
  | 'add_debt_payment'
  | 'add_debt'
  | 'delete_debt'
  | 'clear_debt'
  | 'add_income'
  | 'update_income'
  | 'delete_income'
  | 'add_payment_method'
  | 'delete_payment_method'
  | 'add_savings_account'
  | 'deposit_savings'
  | 'withdraw_savings'
  | 'add_savings_holding'
  | 'update_budget_category'
  | 'update_budget_plan_row'
  | 'replace_budget_plan'
  | 'query'
  | 'unclear'

export interface AIActionItem {
  action: AIAction
  data: Record<string, unknown>
}

export interface AIResponse {
  /** One or more operations; Confirm applies all (non-query) in order. */
  actions: AIActionItem[]
  confidence: number
  clarificationNeeded: string | null
  message: string
}

const AI_ACTIONS: AIAction[] = [
  'add_expense',
  'update_expense',
  'delete_expense',
  'add_debt_payment',
  'add_debt',
  'delete_debt',
  'clear_debt',
  'add_income',
  'update_income',
  'delete_income',
  'add_payment_method',
  'delete_payment_method',
  'add_savings_account',
  'deposit_savings',
  'withdraw_savings',
  'add_savings_holding',
  'update_budget_category',
  'update_budget_plan_row',
  'replace_budget_plan',
  'query',
  'unclear',
]

const actionItemSchema = z.object({
  action: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
})

const aiResponseSchema = z.object({
  actions: z.array(actionItemSchema).optional(),
  action: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional().default({}),
  confidence: z.coerce.number().default(1),
  clarificationNeeded: z.union([z.string(), z.null()]).nullable().optional().default(null),
  message: z.string().default(''),
})

function normalizeAction(raw: string): AIAction {
  return (AI_ACTIONS as string[]).includes(raw) ? (raw as AIAction) : 'query'
}

export function parseModelJsonToAIResponse(text: string, rawFallbackMessage?: string): AIResponse {
  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  }

  let parsedUnknown: unknown
  try {
    parsedUnknown = JSON.parse(jsonStr)
  } catch {
    return {
      actions: [{ action: 'query', data: {} }],
      confidence: 1,
      clarificationNeeded: null,
      message: rawFallbackMessage?.trim() || 'I could not read that response. Please try again.',
    }
  }

  const zResult = aiResponseSchema.safeParse(parsedUnknown)
  if (!zResult.success) {
    return {
      actions: [{ action: 'query', data: {} }],
      confidence: 1,
      clarificationNeeded: null,
      message: 'I could not parse the assistant JSON. Please rephrase your request.',
    }
  }

  const row = zResult.data

  let actions: AIActionItem[]
  if (row.actions && row.actions.length > 0) {
    actions = row.actions.map((item) => ({
      action: normalizeAction(item.action),
      data: item.data,
    }))
  } else if (row.action) {
    actions = [{ action: normalizeAction(row.action), data: row.data ?? {} }]
  } else {
    actions = [{ action: 'query', data: {} }]
  }

  const base: AIResponse = {
    actions,
    confidence: row.confidence,
    clarificationNeeded: row.clarificationNeeded ?? null,
    message: row.message?.trim() || '',
  }

  if (!base.message || base.message.startsWith('{')) {
    base.message = generateFriendlyMessage(base)
  }

  return base
}

export { formatProxyAiErrorForUser } from '@/lib/ai/formatAiProxyError'

export function buildSystemPrompt(
  baseCurrency: Currency,
  paymentMethods: PaymentMethod[],
  debts: Debt[],
  liveDataBlock?: string,
  budgetPlanContext?: { planId: string; planName: string; categoryRows: string },
  incomeSources: IncomeSource[] = [],
  savingsAccounts: SavingsAccount[] = []
): string {
  const methodList = paymentMethods.map((m) => `"${m.name}" (id: ${m.id})`).join(', ')
  const debtList = debts
    .map((d) => {
      const goldish = d.receivedVia === 'gold' || d.isGold
      const typeStr = goldish ? `gold ${d.goldKarat || 24}K, ${d.startingBalance}g` : `${d.currency} ${d.startingBalance}`
      return `"${d.name}" (person: ${d.person}, ${typeStr})`
    })
    .join(', ')
  const incomeList = incomeSources
    .map(
      (i) =>
        `"${i.name}" (${i.currency} ${i.amount}${i.isRecurring ? '/mo equiv' : ' one-time'})`
    )
    .join(', ')
  const savingsAccountList = savingsAccounts
    .map((a) => `"${a.name}" (${a.currency} ${a.currentBalance})`)
    .join(', ')
  const today = new Date().toISOString().slice(0, 10)

  const live = liveDataBlock
    ? `\n\nLIVE_APP_DATA (for action "query" you MUST use these exact numbers; do not invent totals):\n${liveDataBlock}\n`
    : ''

  return `You are Buddgy, a warm personal finance buddy for the Buddget app. Parse the user's natural language and return structured JSON.

CONTEXT:
- Base currency: ${baseCurrency}
- Today's date: ${today}
- Payment methods: ${methodList}
- Income sources: ${incomeList || '(none)'}
- Savings accounts: ${savingsAccountList || '(none)'}
- Expense categories (for add_expense): Rent, Transport, Food, Enjoyment, Debt, Remittance, Other — NOT Savings (use add_savings_holding or deposit_savings for money set aside)
- Budget updates may still use Savings as a category for allocation targets
- Active debts: ${debtList}
${live}
RULES:
1. ALWAYS return a single valid JSON object. No markdown, no code blocks, no extra text.
1b. If the user describes MULTIPLE operations in one message (e.g. a debt payment AND several expenses), return an "actions" ARRAY with one object per operation, IN A SENSIBLE ORDER (e.g. debt payment and each expense as separate add_debt_payment / add_expense entries). Do not merge unrelated items into one action.
2. Default currency to ${baseCurrency} unless user specifies otherwise.
3. Default date to ${today} unless user specifies otherwise.
4. If user mentions a payment method (e.g. "nol silver", "cash", "bank"), match it to the closest one from the list above and INCLUDE it. Do NOT ask for clarification if you can reasonably match it.
5. Only ask for clarification if the user says "nol" with no color specified.
6. When user pays a debt (e.g. "paid mom 2000"), use action "add_debt_payment". Match "mom" to the debt with person "Mom", "dad" to "Dad", etc.
7. IMPORTANT: Debt payments are always in CASH currencies (AED, EGP, USD, etc.), NEVER in XAU/gold — except when the UI explicitly records gold grams. The "currency" field in add_debt_payment must be the cash currency the user is paying in (e.g. "EGP", "AED"). If user says "paid dad 10000 EGP", currency MUST be "EGP".
8. Set confidence to 1.0 when you have all required fields. Only set < 0.8 if truly ambiguous.
9. For "add_payment_method", include data.name and optionally data.type as one of: cash, bank_transfer, card_debit, card_credit, nol, other.
10. For "add_savings_holding", include data.name, data.amount, data.currency, data.bucket as "liquid" or "investment", data.subtype as bank, cash, gold, stocks, crypto, real_estate, other.
11. For "update_budget_category", include data.category (one of the expense categories) and either data.budgetedAmount (number in ${baseCurrency}) OR data.percentOfIncome (0-100). If user sets a percent, use percentOfIncome; if a fixed amount, use budgetedAmount.

12. For "update_budget_plan_row", include data.planId, data.categoryId, data.newAmount (number in base currency). Use this to adjust a single category's budget amount in the active plan.
13. For "replace_budget_plan", include data.planId, data.categories (array of {name, emoji, amount, currency, isSavings?: boolean}). Set isSavings: true only on the savings allocation row; omit or false on expense rows. Use this to completely rebuild the user's budget plan. Only use when the user asks for a full plan rebuild.
14. For "add_debt", include data.name, data.amount, data.currency, data.person (who you owe / who owes you), data.direction ("i_owe" or "they_owe"). Use when the user says they borrowed money or someone owes them.
15. For "delete_expense", include data.description (matches against existing expenses by description text).
16. For "update_expense", include data.description (to find the expense) and data.newAmount, data.newCategory, and/or data.newDescription for changes.
17. For "update_income", include data.name (to find the income source) and data.amount for the new amount (optional: data.currency).
18. For "delete_income", include data.name (to find and remove the income source).
19. For "clear_debt", include data.name or data.person to identify the debt to mark as fully paid.
20. For "deposit_savings", include data.account (savings account name), data.amount, data.currency (optional).
21. For "withdraw_savings", include data.account, data.amount, data.currency (optional).
22. For "add_savings_account", include data.name, data.category ("savings" or "investment"), data.type ("bank", "cash", "gold", "stablecoin", "crypto", "stocks", "real_estate", "other"), data.currency, data.openingBalance (optional).
23. For "delete_payment_method", include data.name to identify the payment method.
${budgetPlanContext ? `
ACTIVE_BUDGET_PLAN:
- Plan ID: ${budgetPlanContext.planId}
- Plan Name: ${budgetPlanContext.planName}
- Category rows (use these categoryId values for update_budget_plan_row):
${budgetPlanContext.categoryRows}
` : ''}
RESPONSE FORMAT for update_budget_plan_row:
{"action":"update_budget_plan_row","data":{"planId":"plan-uuid","categoryId":"category-uuid","newAmount":1500},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for replace_budget_plan:
{"action":"replace_budget_plan","data":{"planId":"plan-uuid","categories":[{"name":"Rent","emoji":"🏠","amount":3000,"currency":"${baseCurrency}"},{"name":"Food","emoji":"🍕","amount":1500,"currency":"${baseCurrency}"},{"name":"Savings","emoji":"💰","amount":2000,"currency":"${baseCurrency}","isSavings":true}]},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for add_expense:
{"action":"add_expense","data":{"description":"string","amount":number,"currency":"${baseCurrency}","category":"Food","paymentMethod":"Bank Transfer","date":"${today}","isRecurring":false},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for add_debt_payment:
{"action":"add_debt_payment","data":{"debtName":"Mom's Debt","person":"Mom","amount":number,"currency":"EGP","date":"${today}","paymentMethod":"Bank Transfer"},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for add_income:
{"action":"add_income","data":{"name":"string","amount":number,"currency":"${baseCurrency}","sourceType":"salary"|"bonus"|"side_hustle"|"investment"|"savings"|"debt"|"gift"|"refund"|"other","isRecurring":true,"recurringFrequency":"monthly"|"biweekly"|"weekly","dayOfMonth":1,"paymentMethod":"optional name from list","person":"when sourceType is debt — who lent the money"},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}
Note: dayOfMonth only when recurringFrequency is monthly; amount is per month, per paycheck, or per week matching recurringFrequency. When sourceType is "debt", include person — the app creates income and a linked debt.

RESPONSE FORMAT for add_payment_method:
{"action":"add_payment_method","data":{"name":"ADCB Visa","type":"card_credit"},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for add_savings_holding:
{"action":"add_savings_holding","data":{"name":"Emergency fund","amount":5000,"currency":"${baseCurrency}","bucket":"liquid","subtype":"bank"},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for update_budget_category:
{"action":"update_budget_category","data":{"category":"Food","budgetedAmount":1200},"confidence":1,"clarificationNeeded":null,"message":"short friendly confirmation"}

RESPONSE FORMAT for queries:
{"action":"query","data":{},"confidence":1,"clarificationNeeded":null,"message":"your answer here"}

RESPONSE FORMAT for MULTIPLE operations in one user message (preferred when user lists several items):
{"actions":[{"action":"add_debt_payment","data":{"person":"Dad","amount":10000,"currency":"EGP","date":"${today}","paymentMethod":"Cash"}},{"action":"add_expense","data":{"description":"Mandi lunch","amount":30,"currency":"AED","category":"Food","paymentMethod":"Cash","date":"${today}","isRecurring":false}},{"action":"add_expense","data":{"description":"Water","amount":1,"currency":"AED","category":"Food","paymentMethod":"Cash","date":"${today}","isRecurring":false}}],"confidence":1,"clarificationNeeded":null,"message":"short summary listing each item"}

You may still use a single top-level "action" + "data" when there is only one operation.

FIELD NAME RULES — use these EXACT field names:
- description, amount, currency, category, paymentMethod, date, isRecurring
- debtName, person (for debt payments)
- name, recurringFrequency, dayOfMonth (for income sources)
- type (for payment methods)
- bucket, subtype (for savings holdings)
- budgetedAmount, percentOfIncome (for budget updates)`
}

export async function sendToGemini(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<AIResponse> {
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    {
      role: 'model',
      parts: [
        {
          text: '{"action":"query","data":{},"confidence":1,"clarificationNeeded":null,"message":"Hi! I can help you add expenses, check your budget, or record debt payments. What would you like to do?"}',
        },
      ],
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ]

  const response = await generateWithFallback({
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  })

  await throwIfAiProxyNotOk(response)

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('No response from AI')
  }

  return parseModelJsonToAIResponse(text, text)
}

function friendlyLineForActionItem(action: AIAction, d: Record<string, unknown>): string {
  switch (action) {
    case 'add_expense': {
      const desc = d.description || 'expense'
      const amt = d.amount || 0
      const cur = d.currency || ''
      return `${cur} ${amt} — ${desc}`
    }
    case 'update_expense': {
      const desc = d.description || 'expense'
      return `Update expense matching "${desc}"`
    }
    case 'delete_expense': {
      const desc = d.description || 'expense'
      return `Delete expense matching "${desc}"`
    }
    case 'add_debt_payment': {
      const person = d.person || d.debtName || 'debt'
      const amt = d.amount || 0
      const cur = d.currency || ''
      return `Debt payment ${cur} ${amt} to ${person}`
    }
    case 'add_debt': {
      const name = d.name || 'debt'
      const amt = d.amount || 0
      return `Add debt "${name}" (${amt})`
    }
    case 'delete_debt': {
      return `Remove debt "${d.name || d.person || ''}"`
    }
    case 'clear_debt': {
      return `Mark debt "${d.name || d.person || ''}" as paid off`
    }
    case 'add_income': {
      const name = d.name || 'income'
      const amt = d.amount || 0
      const cur = d.currency || ''
      return `Income ${cur} ${amt} from ${name}`
    }
    case 'update_income': {
      return `Update income "${d.name || ''}"`
    }
    case 'delete_income': {
      return `Remove income "${d.name || ''}"`
    }
    case 'add_payment_method': {
      const name = d.name || 'payment method'
      return `Add payment method "${name}"`
    }
    case 'delete_payment_method': {
      return `Remove payment method "${d.name || ''}"`
    }
    case 'add_savings_holding': {
      const name = d.name || 'holding'
      const amt = d.amount || 0
      const cur = d.currency || ''
      return `Savings "${name}": ${cur} ${amt}`
    }
    case 'add_savings_account': {
      return `Create savings account "${d.name || ''}"`
    }
    case 'deposit_savings': {
      return `Deposit to "${d.account || d.name || ''}"`
    }
    case 'withdraw_savings': {
      return `Withdraw from "${d.account || d.name || ''}"`
    }
    case 'update_budget_category': {
      const cat = d.category || 'category'
      if (d.percentOfIncome != null) {
        return `Budget ${cat}: ${d.percentOfIncome}% of income`
      }
      const amt = d.budgetedAmount ?? d.amount
      return `Budget ${cat}: ${amt}`
    }
    case 'update_budget_plan_row': {
      const amt = d.newAmount ?? d.amount ?? d.budgetedAmount
      return `Plan category → ${amt} (base currency)`
    }
    case 'replace_budget_plan': {
      const cats = d.categories
      const n = Array.isArray(cats) ? cats.length : 0
      return n > 0 ? `Apply full budget plan (${n} categories)` : 'Apply budget plan'
    }
    case 'unclear':
      return d.clarificationNeeded ? String(d.clarificationNeeded) : 'Could you clarify that?'
    default:
      return ''
  }
}

function generateFriendlyMessage(response: AIResponse): string {
  const actionable = response.actions.filter((a) => a.action !== 'query')
  if (actionable.length === 0) {
    const only = response.actions[0]
    if (only?.action === 'unclear') {
      return friendlyLineForActionItem('unclear', only.data)
    }
    return 'How can I help you?'
  }
  if (actionable.length === 1) {
    const { action, data } = actionable[0]
    const line = friendlyLineForActionItem(action, data)
    if (action === 'unclear') return line
    return `${line}. Please confirm to save.`
  }
  const lines = actionable
    .map(({ action, data }) => friendlyLineForActionItem(action, data))
    .filter(Boolean)
  return `${lines.join(' · ')}. Please confirm to save all.`
}

export async function checkAIStatus(): Promise<{
  enabled: boolean
  model: string
  rateLimit?: { limitingEnabled: boolean; maxRequests: number; windowMs: number }
}> {
  try {
    const res = await fetch('/api/ai')
    if (!res.ok) return { enabled: false, model: '' }
    return await res.json()
  } catch {
    return { enabled: false, model: '' }
  }
}
