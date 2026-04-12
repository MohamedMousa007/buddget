'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { BudgetPlan } from '@/lib/store/types'
import { BudgetPlanTabs } from '@/components/features/budget-planner/BudgetPlanTabs'

export interface BudgetSetupPlanToolbarProps {
  plans: BudgetPlan[]
  activeId: string | null
  editingTabId: string | null
  editingName: string
  onSelect: (id: string) => void
  onStartRename: (plan: { id: string; name: string }) => void
  onEditingNameChange: (name: string) => void
  onCommitRename: () => void
  onAddPlan: () => void
  tabLabels: { addPlan: string }
  activePlan: BudgetPlan | null
  confirmDeleteMessage: string
  deletePlanLabel: string
  onDeleteActivePlan: () => void
}

/**
 * Plan tabs plus delete control for the active plan.
 */
export function BudgetSetupPlanToolbar({
  plans,
  activeId,
  editingTabId,
  editingName,
  onSelect,
  onStartRename,
  onEditingNameChange,
  onCommitRename,
  onAddPlan,
  tabLabels,
  activePlan,
  confirmDeleteMessage,
  deletePlanLabel,
  onDeleteActivePlan,
}: BudgetSetupPlanToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BudgetPlanTabs
          plans={plans}
          activeId={activeId}
          editingTabId={editingTabId}
          editingName={editingName}
          onSelect={onSelect}
          onStartRename={onStartRename}
          onEditingNameChange={onEditingNameChange}
          onCommitRename={onCommitRename}
          onAddPlan={onAddPlan}
          labels={tabLabels}
        />
        {activePlan && !confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)] shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            {deletePlanLabel}
          </button>
        ) : null}
      </div>

      {confirmOpen && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red)]/5 px-4 py-2.5">
          <p className="flex-1 text-xs text-[var(--color-brand-text-primary)]">{confirmDeleteMessage}</p>
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="rounded-lg border border-[var(--color-brand-border)] px-3 py-1.5 text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onDeleteActivePlan()
              setConfirmOpen(false)
            }}
            className="rounded-lg bg-[var(--color-brand-red)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
