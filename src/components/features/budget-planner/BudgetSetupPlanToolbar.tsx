'use client'

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
  return (
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
      {activePlan ? (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(confirmDeleteMessage)) onDeleteActivePlan()
          }}
          className="flex items-center gap-2 text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)] shrink-0"
        >
          <Trash2 className="h-4 w-4" />
          {deletePlanLabel}
        </button>
      ) : null}
    </div>
  )
}
