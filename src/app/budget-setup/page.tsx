'use client'

import { useRef, useEffect } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { BudgetPlannerSummary } from '@/components/features/budget-planner/BudgetPlannerSummary'
import { GoalLensList } from '@/components/features/goals/GoalLensList'
import { BudgetCommittedCard } from '@/components/features/budget-planner/BudgetCommittedCard'
import { BudgetPlannerCategories } from '@/components/features/budget-planner/BudgetPlannerCategories'
import { BudgetSetupNoPlansEmpty } from '@/components/features/budget-planner/BudgetSetupNoPlansEmpty'
import { BudgetSetupPlanToolbar } from '@/components/features/budget-planner/BudgetSetupPlanToolbar'
import { AddIncomeSheet } from '@/components/modals/AddIncomeSheet'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useBudgetSetupPage } from '@/hooks/useBudgetSetupPage'
import { useHydrateBudget, useHydrateIncome, useHydrateExpenses } from '@/hooks/remote'
import { Button } from '@/components/ui/button'

/**
 * Multi-plan budget editor with manual edits and optional guided setup.
 */
export default function BudgetSetupPage() {
  useHydrateBudget()
  useHydrateIncome()
  useHydrateExpenses()
  const p = useBudgetSetupPage()
  const { totalSpentExcludingSavings } = useMonthlyStats()
  const { t } = p
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const planNameInputRef = useRef<HTMLInputElement>(null)
  const hasIncome = p.totalIncome > 0

  useEffect(() => {
    if (p.newPlanDialogOpen) planNameInputRef.current?.select()
  }, [p.newPlanDialogOpen])

  return (
    <div>
      <PageContainer
        wide
        className="py-4 space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-6 lg:gap-y-4 lg:space-y-0"
      >
        {!p.supabaseConfigured || p.user ?
          <>
            <div className="space-y-4 lg:col-span-2">
            {p.budgetPlans.length > 0 ?
              <BudgetSetupPlanToolbar
                plans={p.budgetPlans}
                activeId={p.activeBudgetPlanId}
                editingTabId={p.editingTabId}
                editingName={p.editingName}
                onSelect={p.setActiveBudgetPlanId}
                onStartRename={p.startRename}
                onEditingNameChange={p.setEditingName}
                onCommitRename={p.commitRename}
                onAddPlan={p.handleAddPlan}
                tabLabels={p.tabLabels}
                activePlan={p.activePlan}
                confirmDeleteMessage={t.common.confirmDeleteGeneric}
                deletePlanLabel={t.budgetPlanner.deletePlan}
                onDeleteActivePlan={() => p.deleteBudgetPlan(p.activePlan!.id)}
              />
            : (
              <BudgetSetupNoPlansEmpty
                title={t.budgetPlanner.noPlansEmptyTitle}
                description={t.budgetPlanner.noPlansEmptyDesc}
                createLabel={t.budgetPlanner.noPlansCreateFirst}
                onCreate={p.handleAddPlan}
              />
            )}

            {p.newPlanDialogOpen && (
              <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 space-y-3">
                <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
                  {t.budgetPlanner.newPlanName}
                </p>
                <input
                  ref={planNameInputRef}
                  value={p.newPlanName}
                  onChange={(e) => p.setNewPlanName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') p.commitNewPlan()
                    if (e.key === 'Escape') p.cancelNewPlan()
                  }}
                  className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-focus)]/40"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={p.cancelNewPlan}
                    variant="outline"
                    size="touch"
                  >
                    {t.common.cancel}
                  </Button>
                  <Button onClick={p.commitNewPlan} size="touch">
                    {t.common.ok}
                  </Button>
                </div>
              </div>
            )}

            </div>

            <div
              className={
                p.budgetPlans.length > 0
                  ? 'space-y-4 lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:sticky lg:top-[calc(var(--app-header-h-lg)+1rem)]'
                  : 'space-y-4 lg:col-span-2'
              }
            >
              <BudgetCommittedCard />
              <GoalLensList categories={['spending_control']} />
            </div>

            {p.budgetPlans.length > 0 && (
              <div className="space-y-4 min-w-0 lg:col-start-1 lg:row-start-2">
                <BudgetPlannerSummary
                  totalIncome={p.totalIncome}
                  totalPlanned={p.totalPlanned}
                  spent={totalSpentExcludingSavings}
                  projectedSavings={p.projectedSavings}
                  currency={p.settings.baseCurrency}
                  hasIncome={hasIncome}
                  onAddIncome={() => setActiveModal('addIncome')}
                  labels={{
                    totalIncome: t.budgetPlanner.totalIncome,
                    totalPlanned: t.budgetPlanner.totalPlanned,
                    projectedSavings: t.budgetPlanner.projectedSavings,
                    projectedSavingsLine: t.budgetPlanner.projectedSavingsLine,
                    spentOfPlanned: t.budgetPlanner.spentOfPlanned,
                  }}
                />

                {p.activePlan ?
                  <BudgetPlannerCategories
                    planId={p.activePlan.id}
                    categories={p.activePlan.categories}
                    settings={p.settings}
                    labels={p.categoryLabels}
                    onAddPresetCategory={(icon, name) =>
                      p.addPlanCategory(p.activePlan!.id, { name, icon, amount: 0 })
                    }
                    onAddCustomCategory={(name, icon) =>
                      p.addPlanCategory(p.activePlan!.id, { name, icon, amount: 0 })
                    }
                    onUpdateCategory={(categoryId, updates) =>
                      p.updatePlanCategory(p.activePlan!.id, categoryId, updates)
                    }
                    onDeleteCategory={(categoryId) => p.deletePlanCategory(p.activePlan!.id, categoryId)}
                    onAddSubcategory={(categoryId) =>
                      p.addPlanSubcategory(p.activePlan!.id, categoryId, { name: '', amount: 0, icon: '📦' })
                    }
                    onUpdateSubcategory={(categoryId, subId, updates) =>
                      p.updatePlanSubcategory(p.activePlan!.id, categoryId, subId, updates)
                    }
                    onDeleteSubcategory={(categoryId, subId) =>
                      p.deletePlanSubcategory(p.activePlan!.id, categoryId, subId)
                    }
                  />
                : null}
              </div>
            )}
          </>
        : <div className="min-h-[40vh]" aria-hidden />}
      </PageContainer>

      <AddIncomeSheet />
    </div>
  )
}
