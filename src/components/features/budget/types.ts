import type { BudgetBlock } from '@/lib/store/types'
import type { LineAction } from '@/lib/budget/lineStatus'
import type { BlockView, LineView, PlanMode, PlanView } from '@/lib/budget/planView.types'

/** Props every block body receives. The page composes them inside a `BlockShell` inside a `ChapterCard`. */
export interface BlockBodyProps {
  view: PlanView
  block: BlockView
  mode: PlanMode
  /** Open the line sheet for this line. */
  onOpenLine: (lineId: string) => void
  /** Run a line's status action (review, raise or cap, add a line, update from live, ...). */
  onLineAction: (line: LineView, action: LineAction) => void
  /** Open the add-line sheet for this block. */
  onAdd: (block: BudgetBlock) => void
  /** Navigate to the page that owns a linked block (subscriptions, debts, goals, wealth). */
  onOpenLinked: (block: BudgetBlock) => void
}
