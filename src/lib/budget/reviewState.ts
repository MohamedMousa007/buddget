import { BUDGET_BLOCKS, linesInBlock } from '@/lib/budget/blocks'
import { planSplit } from '@/lib/budget/ledger'
import type { PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock, BudgetPlan } from '@/lib/store/types'

export interface ReviewMarks {
  /** Segments the user marked "Looks right". */
  reviewed: ReadonlySet<BudgetBlock>
  /** Segments the user chose to leave out while building by hand. */
  skipped: ReadonlySet<BudgetBlock>
  /** Building by hand: a segment with no lines and no skip is unfinished, so it is flagged too. */
  flagEmpty: boolean
}

/**
 * The segments still to check, in page order. The single source for the headline, the sticky button
 * and the amber flags, so they cannot disagree.
 */
export function flaggedBlocks(plan: BudgetPlan, marks: ReviewMarks): BudgetBlock[] {
  return BUDGET_BLOCKS.filter((block) => {
    if (marks.reviewed.has(block)) return false
    const lines = linesInBlock(plan, block)
    if (lines.length === 0) return marks.flagEmpty && !marks.skipped.has(block)
    return lines.some((l) => l.confidence === 'estimated')
  })
}

export type DebtFact =
  | { kind: 'by'; month: string }
  | { kind: 'around'; month: string }
  | { kind: 'unknown' }

export type SummaryHeadline =
  | { kind: 'check'; n: number }
  | { kind: 'ready' }
  | { kind: 'over'; amount: number }

export interface ReviewSummary {
  headline: SummaryHeadline
  /** Null when the plan has no debts, or when the red over-income line replaces it. */
  fact: DebtFact | null
}

/** The data-generated summary card: a headline for the job, one fact, never a model-written sentence. */
export function reviewSummary(view: PlanView, flagged: readonly BudgetBlock[]): ReviewSummary {
  if (planSplit(view).overIncome) return { headline: { kind: 'over', amount: -view.free }, fact: null }
  const headline: SummaryHeadline = flagged.length > 0 ? { kind: 'check', n: flagged.length } : { kind: 'ready' }
  const hasDebts = view.blocks.debts.lines.length > 0 || view.extras.debts.length > 0
  if (!hasDebts) return { headline, fact: null }
  const month = view.extras.debtFreeMonth
  if (!month) return { headline, fact: { kind: 'unknown' } }
  return { headline, fact: { kind: flagged.includes('debts') ? 'around' : 'by', month } }
}

/** Activate stays blocked while anything is flagged or the plan commits more than the income. */
export function canActivate(view: PlanView, flagged: readonly BudgetBlock[]): boolean {
  return flagged.length === 0 && !planSplit(view).overIncome
}

/** The next flagged segment after `from` (wrapping), or null when none is left. */
export function nextFlagged(flagged: readonly BudgetBlock[], from: BudgetBlock | null): BudgetBlock | null {
  if (flagged.length === 0) return null
  const after = from ? BUDGET_BLOCKS.indexOf(from) : -1
  return flagged.find((b) => BUDGET_BLOCKS.indexOf(b) > after) ?? flagged[0]
}

/** The next unfinished segment after `from` while building by hand: empty and not skipped. */
export function nextEmpty(plan: BudgetPlan, skipped: ReadonlySet<BudgetBlock>, from: BudgetBlock | null): BudgetBlock | null {
  const open = BUDGET_BLOCKS.filter((b) => linesInBlock(plan, b).length === 0 && !skipped.has(b))
  return nextFlagged(open, from)
}
