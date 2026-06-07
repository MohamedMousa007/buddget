'use client'

import { useRef, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { BudgetPlannerSummary } from '@/components/features/budget-planner/BudgetPlannerSummary'
import { BudgetPlannerCategories } from '@/components/features/budget-planner/BudgetPlannerCategories'
import { BudgetSetupNoPlansEmpty } from '@/components/features/budget-planner/BudgetSetupNoPlansEmpty'
import { BudgetSetupPlanToolbar } from '@/components/features/budget-planner/BudgetSetupPlanToolbar'
import { AddIncomeSheet } from '@/components/modals/AddIncomeSheet'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useBudgetSetupPage } from '@/hooks/useBudgetSetupPage'
import { useHydrateBudget, useHydrateIncome, useHydrateExpenses } from '@/hooks/remote'

/**
 * Multi-plan budget editor with manual edits and optional guided setup.
 */
export default function BudgetSetupPage() {
  useHydrateBudget()
  useHydrateIncome()
  useHydrateExpenses()
  const p = useBudgetSetupPage()
  const { t } = p
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const planNameInputRef = useRef<HTMLInputElement>(null)
  const hasIncome = p.totalIncome > 0

  useEffect(() => {
    if (p.newPlanDialogOpen) planNameInputRef.current?.select()
  }, [p.newPlanDialogOpen])

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.nav.budgetSetup}
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div
        className="px-4 py-4 lg:px-6 max-w-3xl mx-auto space-y-4"
       
      >
        {!p.supabaseConfigured || p.user ?
          <>
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
                  className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)]/40"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={p.cancelNewPlan}
                    className="rounded-xl border border-[var(--color-brand-border)] px-4 py-2 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={p.commitNewPlan}
                    className="rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
                  >
                    {t.common.ok}
                  </button>
                </div>
              </div>
            )}

            {p.budgetPlans.length > 0 && (
              <>
                <BudgetPlannerSummary
                  totalIncome={p.totalIncome}
                  totalPlanned={p.totalPlanned}
                  projectedSavings={p.projectedSavings}
                  currency={p.settings.baseCurrency}
                  hasIncome={hasIncome}
                  onAddIncome={() => setActiveModal('addIncome')}
                  labels={{
                    totalIncome: t.budgetPlanner.totalIncome,
                    totalPlanned: t.budgetPlanner.totalPlanned,
                    projectedSavings: t.budgetPlanner.projectedSavings,
                    projectedSavingsLine: t.budgetPlanner.projectedSavingsLine,
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
              </>
            )}
          </>
        : <div className="min-h-[40vh]" aria-hidden />}
      </div>

      <AddIncomeSheet />
    </div>
  )
}
