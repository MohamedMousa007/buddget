'use client'

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BudgetPlan } from '@/lib/store/types'

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
                className="min-w-[8rem] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-brand-red)]"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                onDoubleClick={() => onStartRename(p)}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-elevated)]/80 text-[var(--color-brand-text-secondary)] hover:text-white border border-transparent hover:border-[var(--color-brand-border)]'
                )}
              >
                {p.name}
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAddPlan}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:text-white hover:border-[var(--color-brand-red)] transition-colors"
        aria-label={labels.addPlan}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )
}
