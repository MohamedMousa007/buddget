import { generateWithFallback, throwIfAiProxyNotOk } from '@/lib/ai/generateWithFallback'
import { coerceGoalCategory } from '@/lib/goals/coerceGoalCategory'
import { isThisMonthOrLater, localPromptDay } from '@/lib/goals/goalDate'
import type { ParsedGoal } from '@/lib/goals/goalAi'

export interface ChatMsg {
  role: 'user' | 'buddgy'
  text: string
}

export interface ChatTurn {
  reply: string
  /** The goal so far, previous values kept where the reply changed nothing. */
  draft: ParsedGoal
  /** Short one-tap replies, at most three. */
  chips: string[]
}

const QUICK = { thinkingConfig: { thinkingLevel: 'minimal' }, maxOutputTokens: 350, temperature: 0.4 }

/** Tolerant parse of one chat turn: needs a reply, everything else falls back to the draft so far. */
export function parseChatReply(text: string, prev: ParsedGoal | null, now: Date): ChatTurn {
  const raw = text.match(/\{[\s\S]*\}/)?.[0]
  if (!raw) throw new Error('unreadable')
  const o = JSON.parse(raw) as { reply?: unknown; draft?: Record<string, unknown>; chips?: unknown }
  const reply = String(o.reply ?? '').trim()
  if (!reply) throw new Error('unreadable')
  const d = o.draft ?? {}
  const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim() : prev?.name
  const target = Number(d.target)
  const date = typeof d.date === 'string' && /^\d{4}-\d{2}/.test(d.date) ? `${d.date.slice(0, 7)}-01` : undefined
  const future = date && isThisMonthOrLater(date, now)
  return {
    reply,
    draft: {
      category: d.category ? coerceGoalCategory(d.category) : (prev?.category ?? 'custom'),
      name: name ?? 'My goal',
      target: Number.isFinite(target) && target > 0 ? Math.round(target) : prev?.target,
      date: future ? date : prev?.date,
    },
    chips: Array.isArray(o.chips) ? o.chips.map((c) => String(c).trim()).filter(Boolean).slice(0, 3) : [],
  }
}

/** One Buddgy turn while the user shapes a goal. Quick model, no thinking: the plan maths stays in the app. */
export async function goalChatTurn(
  input: {
    history: ChatMsg[]
    draft: ParsedGoal | null
    currency: string
    usualKeep: number | null
    now: Date
  },
  signal?: AbortSignal,
): Promise<ChatTurn> {
  const facts =
    `Today is ${localPromptDay(input.now)}. Currency ${input.currency}. ` +
    (input.usualKeep ? `The user usually keeps about ${Math.round(input.usualKeep)} ${input.currency} a month.` : 'Their monthly savings are not known yet.')
  const system =
    `You are Buddgy, a warm, brief money counselor inside a budgeting app, helping the user shape ONE savings goal. ${facts} ` +
    `Reply in the user's language, 1-2 short sentences, never preachy. If the amount is missing, suggest a realistic typical amount; ` +
    `if the date is missing, suggest one; ask for only one thing at a time. When both are set, say briefly whether it fits their monthly savings (use the numbers given). ` +
    `Current goal: ${JSON.stringify(input.draft ?? {})}. ` +
    `Reply with ONLY JSON: {"reply": string, "draft": {"category": one of emergency_fund, house, car, vacation, education, wedding, retirement, business, phone_device, gift, investment, family_support, sadaqah_charity, custom, "name": short title, "target": number or null, "date": "YYYY-MM" or null}, "chips": up to 3 short quick replies the user could tap (max 4 words each)}.`
  const res = await generateWithFallback(
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: input.history.slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text.slice(0, 400) }] })),
      generationConfig: QUICK,
      tier: 'fast',
    },
    { signal, maxAttempts: 2 },
  )
  await throwIfAiProxyNotOk(res)
  const payload = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return parseChatReply(payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '', input.draft, input.now)
}
