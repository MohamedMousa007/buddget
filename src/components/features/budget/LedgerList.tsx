'use client'

import { Card } from '@/components/ui/card'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { LedgerRow, type LedgerRowProps } from './LedgerRow'

export interface LedgerListProps {
  view: PlanView
  review?: boolean
  onOpen: (block: BudgetBlock) => void
  /** Per-row extras for the builder: a status override and a tag. */
  rowExtras?: (block: BudgetBlock) => Pick<LedgerRowProps, 'statusOverride' | 'tag' | 'flagged'>
}

/** The seven segments as one list: the Budget page's whole overview below the hero. */
export function LedgerList({ view, review = false, onOpen, rowExtras }: LedgerListProps) {
  const today = new Date().getDate()
  return (
    <Card render={<ul />} padding="none" divide>
      {BUDGET_BLOCKS.map((block) => (
        <LedgerRow key={block} view={view} block={block} today={today} review={review} onOpen={() => onOpen(block)} {...rowExtras?.(block)} />
      ))}
    </Card>
  )
}
