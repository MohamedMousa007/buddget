import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import { coerceGoalCategory } from '@/lib/goals/coerceGoalCategory'
import type { GoalCategory } from '@/lib/store/types'

export interface ParsedGoal {
  category: GoalCategory
  name: string
  target?: number
  /** `YYYY-MM-01` */
  date?: string
}

export interface CostOption {
  label: string
  amount: number
}

export interface CostEstimate {
  options: CostOption[]
  assumption: string
}

const firstJson = (text: string) => text.match(/\{[\s\S]*\}/)?.[0]

async function askJson(prompt: string, opts: { grounded?: boolean; signal?: AbortSignal }): Promise<string> {
  const res = await generateWithFallback(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      grounded: opts.grounded,
      tier: opts.grounded ? undefined : 'fast',
    },
    { signal: opts.signal },
  )
  await throwIfAiProxyNotOk(res)
  const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
}

export function parseGoalReply(text: string, now: Date): ParsedGoal {
  const raw = firstJson(text)
  if (!raw) throw new Error('unreadable')
  const o = JSON.parse(raw) as Record<string, unknown>
  const name = String(o.name ?? '').trim()
  if (!name) throw new Error('unreadable')
  const target = Number(o.target)
  const date = typeof o.date === 'string' && /^\d{4}-\d{2}/.test(o.date) ? `${o.date.slice(0, 7)}-01` : undefined
  return {
    category: coerceGoalCategory(o.category),
    name,
    target: Number.isFinite(target) && target > 0 ? Math.round(target) : undefined,
    date: date && date > now.toISOString().slice(0, 7) ? date : undefined,
  }
}

/** Free text ("A week in Dahab next summer") to category, name and, when stated, amount and month. */
export async function parseGoalText(
  text: string,
  input: { currency: string; now: Date },
  signal?: AbortSignal,
): Promise<ParsedGoal> {
  const prompt =
    `Turn the user's savings goal into JSON. Today is ${input.now.toISOString().slice(0, 10)}. ` +
    `Currency: ${input.currency}. Reply with ONLY JSON: {"category": one of emergency_fund, house, car, vacation, education, ` +
    `wedding, retirement, business, phone_device, gift, investment, family_support, sadaqah_charity, custom; ` +
    `"name": short title; "target": number in ${input.currency} only if the user stated or clearly implied one; ` +
    `"date": "YYYY-MM" only if a time was stated}. Goal: """${text.slice(0, 300)}"""`
  return parseGoalReply(await askJson(prompt, { signal }), input.now)
}

export function parseCostReply(text: string): CostEstimate {
  const raw = firstJson(text)
  if (!raw) throw new Error('unreadable')
  const o = JSON.parse(raw) as { options?: Array<{ label?: unknown; amount?: unknown }>; assumption?: unknown }
  const options = (o.options ?? [])
    .map((x) => ({ label: String(x.label ?? '').trim(), amount: Math.round(Number(x.amount)) }))
    .filter((x) => x.label && Number.isFinite(x.amount) && x.amount > 0)
    .slice(0, 3)
  if (options.length === 0) throw new Error('unreadable')
  return { options, assumption: String(o.assumption ?? '').trim() }
}

/** Three priced options for what the goal usually costs, using live local prices. */
export async function estimateGoalCost(
  input: { name: string; category: string; currency: string; country?: string },
  signal?: AbortSignal,
): Promise<CostEstimate> {
  const where = input.country ? ` in ${input.country}` : ''
  const prompt =
    `Estimate what "${input.name}" (${input.category}) typically costs${where}, in ${input.currency}, at current prices. ` +
    `Give exactly three options from cheaper to pricier. Reply with ONLY JSON: ` +
    `{"options":[{"label":"<2-4 words>","amount":<number>}],"assumption":"<one short sentence of what is assumed>"}.`
  return parseCostReply(await askJson(prompt, { grounded: true, signal }))
}
