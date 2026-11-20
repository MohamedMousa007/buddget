import type { BuddgyItem, ChatItem, UserItem } from '@/lib/buddgy/client/chatTypes'
import { nextQuestion, type ScreenAnswer } from '@/lib/budget/flow/flow'
import { questionText } from '@/lib/budget/flow/questionText'
import type { BudgetStudioCopy } from '@/lib/i18n/budgetPage/studioCopy'
import { answerScreen, backScreen, planPhase, planState, type ChatPlan } from './chatPlan'
import { parseTyped } from './parseTyped'
import { answerText, fillFor } from './planSummary'

/** What a chat step needs besides the plan: the builder's words, money formatting, the clock and ids. No model, no network. */
export interface PlanCtx {
  ui: BudgetStudioCopy
  money: (n: number) => string
  now: number
  newId: () => string
}

export interface PlanStep {
  plan: ChatPlan
  items: ChatItem[]
}

/** The words at the top of the screen being asked now, as the builder titles it. */
export function screenTitle(p: ChatPlan, ctx: Pick<PlanCtx, 'ui' | 'money'>): string {
  const s = planState(p)
  const head = nextQuestion(s)
  if (!head) return ''
  return head.control === 'confirm' ? ctx.ui.found.title : questionText(ctx.ui, head, s, fillFor(s, ctx.money))
}

/**
 * One answered screen: the question becomes Buddgy's line, the answer the person's bubble, and the flow moves on through the
 * builder's own reducer. `said` is what the person typed, shown as they wrote it.
 */
export function submitScreen(p: ChatPlan, items: readonly ChatItem[], answers: ScreenAnswer[], ctx: PlanCtx, said?: string): PlanStep {
  if (planPhase(p) !== 'asking' || answers.length === 0) return { plan: p, items: [...items] }
  const q: BuddgyItem = { id: ctx.newId(), role: 'buddgy', text: screenTitle(p, ctx), proposals: [], reads: [], status: 'done' }
  const a: UserItem = { id: ctx.newId(), role: 'user', text: said ?? answerText(answers, ctx.ui, ctx.money) }
  return { plan: answerScreen(p, answers, [q.id, a.id], ctx.now), items: [...items, q, a] }
}

/** A typed reply to the question asked now, or null when it cannot be read and the question is asked again. */
export function typedAnswer(p: ChatPlan, items: readonly ChatItem[], text: string, ctx: PlanCtx): PlanStep | null {
  const head = nextQuestion(planState(p))
  if (!head || planPhase(p) !== 'asking') return null
  const value = parseTyped(head, text, ctx.ui.q[head.id] ?? { label: head.id, why: '' })
  return value === undefined ? null : submitScreen(p, items, [{ id: head.id, value }], ctx, text.trim())
}

/** Back: the last screen is taken out of the flow and its two bubbles out of the chat. */
export function takeBack(p: ChatPlan, items: readonly ChatItem[], now: number): PlanStep {
  const { plan, drop } = backScreen(p, now)
  return { plan, items: items.filter((i) => !drop.includes(i.id)) }
}
