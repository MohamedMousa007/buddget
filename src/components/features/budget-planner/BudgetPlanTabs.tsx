'use client'

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BudgetPlan } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'

export interface BudgetPlanTabsProps {
  plans: BudgetPlan[]
  activeId: string | null
  editingTabId: string | null
  editingName: string
  onSelect: (id: string) => void
  onStartRename: (plan: BudgetPlan) => void
  onEditingNameChange: (v: string) => void
  onCommitRename: () => void
  onAddPlan: () => void
  labels: { addPlan: string }
}

/** Horizontally scrollable plan tabs + add button. */
export function BudgetPlanTabs({
  plans,
  activeId,
  editingTabId,
  editingName,
  onSelect,
  onStartRename,
  onEditingNameChange,
  onCommitRename,
  onAddPlan,
  labels,
}: BudgetPlanTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
      {plans.map((p) => {
        const active = p.id === activeId
        const editing = p.id === editingTabId
        return (
          <div key={p.id} className="flex shrink-0 items-center gap-1">
            {editing ? (
              <input
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onBlur={onCommitRename}
                onKeyDown={(e) => e.key === 'Enter' && onCommitRename()}
                className="min-w-[8rem] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)] outline-none focus:border-[var(--color-brand-focus)]"
                autoFocus
              />
            ) : (
              <OptionChip
                selected={active}
                onClick={() => onSelect(p.id)}
                onDoubleClick={() => onStartRename(p)}
              >
                {p.name}
              </OptionChip>
            )}
          </div>
        )
      })}
      <IconButton
        onClick={onAddPlan}
        aria-label={labels.addPlan}
        variant="outlined"
        size="sm"
        className="shrink-0 border-dashed hover:border-[var(--color-brand-primary)]"
      >
        <Plus className="h-5 w-5" />
      </IconButton>
    </div>
  )
}
