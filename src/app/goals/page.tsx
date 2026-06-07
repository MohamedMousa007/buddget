'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Target } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { GoalCard } from '@/components/features/goals/GoalCard'
import { AddGoalSheet } from '@/components/modals/AddGoalSheet'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { Goal } from '@/lib/store/types'
import { useHydrateGoals, useHydrateSavings, useHydrateDebts } from '@/hooks/remote'

export default function GoalsPage() {
  useHydrateGoals()
  useHydrateSavings()
  useHydrateDebts()
  const t = useT()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const { goals, deleteGoal } = useFinanceStore(
    useShallow((s) => ({
      goals: s.goals,
      deleteGoal: s.deleteGoal,
    }))
  )

  const { active, achieved } = useMemo(() => {
    const a = goals.filter((g) => g.status === 'active' || g.status === 'paused')
    const z = goals.filter((g) => g.status === 'achieved')
    a.sort((x, y) => x.priority - y.priority)
    z.sort((x, y) => (y.achievedAt ?? '').localeCompare(x.achievedAt ?? ''))
    return { active: a, achieved: z }
  }, [goals])

  const openAdd = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  const openEdit = (g: Goal) => {
    setEditing(g)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setEditing(null)
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <div className="flex items-center justify-between gap-4 w-full">
            <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
              <Target className="w-6 h-6 text-[var(--color-brand-red)]" aria-hidden />
              {t.goals.pageTitle}
            </h1>
            <button
              type="button"
              onClick={openAdd}
              className="shrink-0 px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-sm font-semibold text-white transition-colors"
            >
              {t.goals.addGoal}
            </button>
          </div>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-4 lg:px-6 max-w-2xl mx-auto space-y-4">
        {goals.length === 0 ? (
          <EmptyState
            title={t.goals.emptyState}
            description={t.goals.emptyStateHint}
            action={
              <button
                type="button"
                onClick={openAdd}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-sm font-semibold text-white transition-colors"
              >
                {t.goals.addGoal}
              </button>
            }
          />
        ) : (
          <>
            <section className="space-y-3">
              {active.map((g, idx) => {
                return (
                  <div key={g.id}>
                    <GoalCard goal={g} t={t.goals} onEdit={openEdit} onDelete={deleteGoal} />
                  </div>
                )
              })}
            </section>
            {achieved.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-[var(--color-brand-text-muted)]">
                  —— {t.goals.achievedSection} ——
                </h2>
                {achieved.map((g) => (
                  <GoalCard key={g.id} goal={g} t={t.goals} onEdit={openEdit} onDelete={deleteGoal} />
                ))}
              </section>
            ) : null}
          </>
        )}
      </div>

      <AddGoalSheet open={sheetOpen} onClose={closeSheet} editingGoal={editing} />
    </div>
  )
}
