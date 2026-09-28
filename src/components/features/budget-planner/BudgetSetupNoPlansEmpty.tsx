'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'

export interface BudgetSetupNoPlansEmptyProps {
  title: string
  description: string
  createLabel: string
  onCreate: () => void
}

/**
 * First-run empty state when the user has no budget plans yet.
 */
export function BudgetSetupNoPlansEmpty({
  title,
  description,
  createLabel,
  onCreate,
}: BudgetSetupNoPlansEmptyProps) {
  return (
    <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-4 sm:p-5">
      <EmptyState
        icon="🎯"
        title={title}
        description={description}
        className="py-12"
        action={
          <Button onClick={onCreate} size="touch">
            {createLabel}
          </Button>
        }
      />
    </div>
  )
}
