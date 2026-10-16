'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { PageBody } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { GoalCard } from '@/components/features/goals/GoalCard'
import { AddGoalSheet } from '@/components/modals/AddGoalSheet'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { Goal } from '@/lib/store/types'
import { useHydrateGoals, useHydrateSavings, useHydrateDebts } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'

export default function GoalsPage() {
  useHydrateGoals()
  useHydrateSavings()
  useHydrateDebts()
  const dataReady = useFinanceStore((s) => s.dataReady)
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

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div>
      <PageHeader>
        <PageHeaderContent width="wide">
          <div className="flex items-center justify-end gap-4 w-full">
            <Button size="touch" onClick={openAdd} className="font-semibold">
              {t.goals.addGoal}
            </Button>
          </div>
        </PageHeaderContent>
      </PageHeader>

      <PageBody className="space-y-4">
        {goals.length === 0 ? (
          <EmptyState
            title={t.goals.emptyState}
            description={t.goals.emptyStateHint}
            action={
              <Button size="cta" onClick={openAdd} className="font-semibold">
                {t.goals.addGoal}
              </Button>
            }
          />
        ) : (
          <>
            <section className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
              {active.map((g) => {
                return (
                  <div key={g.id}>
                    <GoalCard goal={g} t={t.goals} onEdit={openEdit} onDelete={deleteGoal} />
                  </div>
                )
              })}
            </section>
            {achieved.length > 0 ? (
              <section className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
                <h2 className="lg:col-span-2 text-sm font-medium text-[var(--color-brand-text-muted)]">
                  —— {t.goals.achievedSection} ——
                </h2>
                {achieved.map((g) => (
                  <GoalCard key={g.id} goal={g} t={t.goals} onEdit={openEdit} onDelete={deleteGoal} />
                ))}
              </section>
            ) : null}
          </>
        )}
      </PageBody>

      <AddGoalSheet open={sheetOpen} onClose={closeSheet} editingGoal={editing} />
    </div>
  )
}
