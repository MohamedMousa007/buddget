import { describe, it, expect } from 'vitest'
import type { Debt, IncomeSource, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { buildGeminiBody, buildSystemPrompt, buildVoiceExtractPrompt, parseModelJsonToAIResponse } from '@/lib/ai/gemini'
import { thinkingFor } from '@/lib/ai/runAiCommand'

/**
 * Live golden set: real phrasings (EN + Egyptian/MSA Arabic) → the action Buddgy
 * must produce. Hits the real Gemini API, so it only runs with a key:
 *
 *   GEMINI_API_KEY=… npm run eval:ai
 *
 * Run it before changing a prompt or a model; a drop here is a regression users
 * would feel. Assertions are on the parts that matter (action, amount, category),
 * not on wording.
 */
const KEY = process.env.GEMINI_API_KEY
const MODELS = {
  fast: process.env.GEMINI_MODEL_FAST || 'gemini-3.1-flash-lite',
  smart: process.env.GEMINI_MODEL_SMART || 'gemini-3.5-flash',
}

const pms = [
  { id: 'pm1', name: 'Cash' }, { id: 'pm2', name: 'ADCB Visa' }, { id: 'pm3', name: 'Nol Silver' }, { id: 'pm4', name: 'Nol Gold' },
] as PaymentMethod[]
const debts = [{ name: "Mom's loan", person: 'Mom', currency: 'EGP', startingBalance: 20000 }] as Debt[]
const income = [{ name: 'Salary', currency: 'AED', amount: 15000, isRecurring: true }] as IncomeSource[]
const savings = [{ name: 'Emergency', currency: 'AED', currentBalance: 8000 }] as SavingsAccount[]
const live = [
  'Billing month: 2026-09', 'Base currency: AED', 'Monthly income (estimated): 15000',
  'Spent this month (expense categories, excl. Savings): 7200', 'Budget for expenses (excl. Savings allocation): 9000',
  'Remaining vs expense budget: 1800', 'Days left in month: 12', 'Left to spend: 1800 (safe daily: 150)',
  'Pace: warning (projected month spend 9600)', 'Spent by category (spent/budget): Food 2600/2000, Rent 3500/3500, Transport 600/800',
].join('\n')

type Case = [text: string, action: string | string[], fields?: Record<string, unknown>]

/** Quick capture — the fast tier. */
const CAPTURE: Case[] = [
  ['coffee 15 cash', 'add_expense', { amount: 15, category: 'Food' }],
  ['talabat 85 on visa', 'add_expense', { amount: 85, category: 'Food' }],
  ['taxi 42', 'add_expense', { amount: 42, category: 'Transport' }],
  ['paid rent 3500', 'add_expense', { amount: 3500, category: 'Rent' }],
  ['cinema tickets 90 with visa', 'add_expense', { amount: 90, category: 'Enjoyment' }],
  ['groceries 230 from carrefour', 'add_expense', { amount: 230, category: 'Food' }],
  ['sent 1000 to my brother in egypt', ['add_expense'], { amount: 1000 }],
  ['topped up nol silver 50', ['add_expense'], { amount: 50 }],
  ['lunch 30 and water 2', 'add_expense'],
  ['paid mom 2000 egp', 'add_debt_payment', { amount: 2000, currency: 'EGP' }],
  ['got my salary 15000', 'add_income', { amount: 15000 }],
  ['received 500 bonus', 'add_income', { amount: 500 }],
  ['borrowed 3000 from ahmed', 'add_debt', { amount: 3000 }],
  ['put 1000 in emergency savings', 'deposit_savings', { amount: 1000 }],
  ['took 500 out of emergency', 'withdraw_savings', { amount: 500 }],
  ['netflix 45', 'add_expense', { amount: 45 }],
  ['gym membership 250 visa', 'add_expense', { amount: 250 }],
  ['pharmacy 64.5', 'add_expense', { amount: 64.5 }],
  ['parking 10 cash', 'add_expense', { amount: 10, category: 'Transport' }],
  ['dinner with friends 180', 'add_expense', { amount: 180, category: 'Food' }],
  ['قهوة ١٥ كاش', 'add_expense', { amount: 15 }],
  ['دفعت ٨٥ طلبات بالفيزا', 'add_expense', { amount: 85 }],
  ['تاكسي ٤٠', 'add_expense', { amount: 40 }],
  ['صرفت ٢٠٠ على البقالة', 'add_expense', { amount: 200 }],
  ['دفعت لماما ٢٠٠٠ جنيه', 'add_debt_payment', { amount: 2000 }],
  ['استلمت المرتب ١٥٠٠٠', 'add_income', { amount: 15000 }],
  ['حطيت ١٠٠٠ في التوفير', 'deposit_savings', { amount: 1000 }],
  ['اشتريت جزمة ب ٣٠٠', 'add_expense', { amount: 300 }],
  ['بنزين ١٢٠', 'add_expense', { amount: 120 }],
  ['فاتورة الكهربا ٤٥٠', 'add_expense', { amount: 450 }],
]

/** Questions and planning — the smart tier with the live block. */
const CHAT: Case[] = [
  ['how much can I spend per day?', 'query'],
  ['am I over budget on anything?', 'query'],
  ['will my money last until the end of the month?', 'query'],
  ['where did most of my money go this month?', ['query', 'lookup']],
  ['what did I spend at talabat last month?', 'lookup'],
  ['compare my food spending to last month', 'lookup'],
  ['what are my biggest purchases this month?', ['lookup', 'query']],
  ['list my subscriptions', 'lookup'],
  ['set my food budget to 2500', ['update_budget_category', 'update_budget_plan_row']],
  ['change the taxi expense to 50', 'update_expense'],
  ['delete the netflix expense', 'delete_expense'],
  ['I paid off my mom loan completely', ['clear_debt', 'add_debt_payment']],
  ['add a goal to save 30000 for a car by next year', 'add_goal', { targetAmount: 30000 }],
  ['my salary comes on the 25th', ['remember', 'update_income', 'query']],
  ['hi', 'query'],
  ['what can you do?', 'query'],
  ['كام فاضلي أصرف في اليوم؟', 'query'],
  ['أنا متجاوز الميزانية في إيه؟', 'query'],
  ['صرفت كام على طلبات الشهر اللي فات؟', 'lookup'],
  ['غير ميزانية الأكل ل ٢٥٠٠', ['update_budget_category', 'update_budget_plan_row']],
]

async function ask(tier: 'fast' | 'smart', system: string, text: string) {
  const body = buildGeminiBody(system, text, [], { thinking: tier === 'fast' ? 'minimal' : thinkingFor(text), maxOutputTokens: 2048 })
  const t0 = Date.now()
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS[tier]}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  const text2 = (json.candidates?.[0]?.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text: string }) => p.text).join('')
  return { r: parseModelJsonToAIResponse(text2), ms: Date.now() - t0 }
}

function check([text, action, fields]: Case, r: ReturnType<typeof parseModelJsonToAIResponse>) {
  const want = Array.isArray(action) ? action : [action]
  const hit = r.actions.find((a) => want.includes(a.action))
  expect(hit, `"${text}" → ${r.actions.map((a) => a.action).join(',')}`).toBeTruthy()
  for (const [k, v] of Object.entries(fields ?? {})) {
    expect(hit!.data[k] === v || Number(hit!.data[k]) === v, `"${text}" ${k}=${String(hit!.data[k])}`).toBe(true)
  }
}

describe.skipIf(!KEY)('Buddgy golden set (live)', () => {
  const capturePrompt = buildVoiceExtractPrompt('AED', pms, debts, income, savings)
  const chatPrompt = buildSystemPrompt('AED', pms, debts, live, undefined, income, savings, [], 'chat')

  it.each(CAPTURE)('capture: %s', async (...c) => {
    const { r, ms } = await ask('fast', capturePrompt, c[0])
    check(c as Case, r)
    expect(ms).toBeLessThan(6000)
  }, 20_000)

  it.each(CHAT)('chat: %s', async (...c) => {
    const { r } = await ask('smart', chatPrompt, c[0])
    check(c as Case, r)
    expect(r.message.length).toBeGreaterThan(0)
  }, 40_000)
})
