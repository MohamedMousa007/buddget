'use client'

import { EmptyState } from '@/components/ui/EmptyState'

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
    <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
      <EmptyState
        icon="🎯"
        title={title}
        description={description}
        className="py-12"
        action={
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {createLabel}
          </button>
        }
      />
    </div>
  )
}
