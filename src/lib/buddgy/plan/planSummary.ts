import { BLOCK_CHAPTER, CHAPTERS, type BudgetChapter } from '@/lib/budget/blocks'
import type { PlanDraft } from '@/lib/budget/facts'
import type { FactsSlice } from '@/lib/budget/factsFromStore'
import { NODE_BY_ID } from '@/lib/budget/flow/nodes'
import type { ScreenAnswer } from '@/lib/budget/flow/flow'
import type { FlowState, FlowValue } from '@/lib/budget/flow/types'
import { get } from '@/lib/budget/flow/derive'
import { engineDraft, studioFacts } from '@/lib/budget/studioPreview'
import type { BudgetStudioCopy } from '@/lib/i18n/budgetPage/studioCopy'
import { planState, type ChatPlan } from './chatPlan'

const PERCENT_ANSWERS = new Set(['partnerSharePct', 'taxPct'])
const TOP_LINES = 4

/** The plan the builder's engine makes from the chat's answers, before the AI pass and with nothing written: what the ready card shows. */
export function chatPreview(live: FactsSlice, p: ChatPlan, now = new Date()): PlanDraft {
  const s = planState(p)
  return engineDraft(studioFacts(live, s.a, s.intent, new Set(), now))
}

export interface PlanSummary {
  income: number
  chapters: { key: BudgetChapter; amount: number; percent: number }[]
  top: { name: string; amount: number }[]
  rest: { count: number; amount: number }
}

/** The draft folded into the plan page's three chapters, the biggest lines, and the rest as one total. */
export function summarize(d: PlanDraft): PlanSummary {
  const total = d.lines.reduce((t, l) => t + l.amount, 0)
  const chapters = CHAPTERS.map((key) => {
    const amount = d.lines.filter((l) => BLOCK_CHAPTER[l.block] === key).reduce((t, l) => t + l.amount, 0)
    return { key, amount, percent: total > 0 ? Math.round((amount / total) * 100) : 0 }
  }).filter((c) => c.amount > 0)
  const sorted = [...d.lines].filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount)
  const top = sorted.slice(0, TOP_LINES).map((l) => ({ name: l.name, amount: l.amount }))
  const rest = sorted.slice(TOP_LINES)
  return { income: d.income, chapters, top, rest: { count: rest.length, amount: rest.reduce((t, l) => t + l.amount, 0) } }
}

/** Fills `{income}` and `{n}` in a question, as the builder does. */
export function fillFor(s: FlowState, money: (n: number) => string) {
  return (id: string): string =>
    id === 'confirmIncome' ? money(Number(get(s, 'income')) || 0)
      : id === 'confirmBills' ? String(Number(s.known.knownBillCount ?? 0) + Number(s.known.knownSubCount ?? 0))
        : id === 'confirmDebts' ? String(s.known.knownDebtCount ?? 0)
          : String(s.known.knownGoalCount ?? 0)
}

function valueText(id: string, v: FlowValue, ui: BudgetStudioCopy, money: (n: number) => string): string {
  const x = NODE_BY_ID.get(id)
  const copy = ui.q[id]
  if (x?.control === 'confirm') return v === false ? ui.found.change : ui.found.right
  if (Array.isArray(v)) return v.map((o) => copy?.opts?.[o] ?? o).join(', ') || '-'
  if (typeof v === 'boolean') return v ? ui.yes : ui.no
  if (typeof v === 'number') return x?.control === 'amount' ? money(v) : PERCENT_ANSWERS.has(id) ? `${v}%` : String(v)
  return copy?.opts?.[v] ?? v
}

/** One screen's answers as the person's chat bubble. */
export const answerText = (answers: readonly ScreenAnswer[], ui: BudgetStudioCopy, money: (n: number) => string): string =>
  answers.map((x) => ('skip' in x ? ui.estimate : valueText(x.id, x.value, ui, money))).join(' · ')
