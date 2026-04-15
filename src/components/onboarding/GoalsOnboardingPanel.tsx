'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { GoalCard } from '@/components/features/goals/GoalCard'
import { AddGoalSheet } from '@/components/modals/AddGoalSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Goal } from '@/lib/store/types'

/**
 * Bidirectional onboarding panel for goals: reads & writes the live `goals` store.
 * Reuses AddGoalSheet so the onboarding experience matches the /goals page 1:1.
 */
export function GoalsOnboardingPanel() {
  const t = useT()
  const { goals, deleteGoal } = useFinanceStore(
    useShallow((s) => ({ goals: s.goals, deleteGoal: s.deleteGoal }))
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const active = useMemo(
    () => goals.filter((g) => g.status === 'active' || g.status === 'paused'),
    [goals]
  )

  const openAdd = () => {
    setEditing(null)
    setSheetOpen(true)
  }
  const openEdit = (g: Goal) => {
    setEditing(g)
    setSheetOpen(true)
  }
  const handleDelete = (id: string) => {
    if (globalThis.confirm?.(t.goals.confirmDelete)) {
      deleteGoal(id)
    }
  }
  const closeSheet = () => {
    setSheetOpen(false)
    setEditing(null)
  }

  return (
    <div className="w-full space-y-3 text-start">
      {active.length === 0 ? (
        <EmptyState
          title={t.goals.emptyState}
          description={t.goals.emptyStateHint}
        />
      ) : (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              t={t.goals}
              onEdit={openEdit}
              onDelete={handleDelete}
              compact
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openAdd}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-brand-border)] px-4 py-3 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)] transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden />
        {t.goals.addGoal}
      </button>

      <AddGoalSheet open={sheetOpen} onClose={closeSheet} editingGoal={editing} />
    </div>
  )
}
