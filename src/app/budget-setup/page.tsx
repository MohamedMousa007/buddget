'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { totalPlannedExpensesForPlan } from '@/lib/budget/budgetPlans'
import { BudgetPlanTabs } from '@/components/features/budget-planner/BudgetPlanTabs'
import { BudgetPlannerSummary } from '@/components/features/budget-planner/BudgetPlannerSummary'
import { BudgetPlannerCategories } from '@/components/features/budget-planner/BudgetPlannerCategories'
import { BudgetPlannerAiEvalCard } from '@/components/features/budget-planner/BudgetPlannerAiEvalCard'
import { BudgetPlannerChatPanel } from '@/components/features/budget-planner/BudgetPlannerChatPanel'
import { useBudgetPlanEval } from '@/hooks/useBudgetPlanEval'
import { useBudgetPlannerChat } from '@/hooks/useBudgetPlannerChat'

/**
 * Multi-plan budget editor with subcategories, projected savings, and AI evaluation + chat.
 */
export default function BudgetSetupPage() {
  const t = useT()
  const {
    budgetPlans,
    activeBudgetPlanId,
    incomeSources,
    settings,
    exchangeRates,
    addBudgetPlan,
    updateBudgetPlan,
    deleteBudgetPlan,
    setActiveBudgetPlanId,
    addPlanCategory,
    updatePlanCategory,
    deletePlanCategory,
    addPlanSubcategory,
    updatePlanSubcategory,
    deletePlanSubcategory,
  } = useFinanceStore(
    useShallow((s) => ({
      budgetPlans: s.budgetPlans,
      activeBudgetPlanId: s.activeBudgetPlanId,
      incomeSources: s.incomeSources,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      addBudgetPlan: s.addBudgetPlan,
      updateBudgetPlan: s.updateBudgetPlan,
      deleteBudgetPlan: s.deleteBudgetPlan,
      setActiveBudgetPlanId: s.setActiveBudgetPlanId,
      addPlanCategory: s.addPlanCategory,
      updatePlanCategory: s.updatePlanCategory,
      deletePlanCategory: s.deletePlanCategory,
      addPlanSubcategory: s.addPlanSubcategory,
      updatePlanSubcategory: s.updatePlanSubcategory,
      deletePlanSubcategory: s.deletePlanSubcategory,
    }))
  )

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const autoPlanCreatedRef = useRef(false)

  useEffect(() => {
    if (autoPlanCreatedRef.current || budgetPlans.length > 0) return
    autoPlanCreatedRef.current = true
    addBudgetPlan(t.budgetPlanner.defaultPlanName)
  }, [budgetPlans.length, addBudgetPlan, t.budgetPlanner.defaultPlanName])

  const activePlan = useMemo(() => {
    if (budgetPlans.length === 0) return null
    return budgetPlans.find((p) => p.id === activeBudgetPlanId) ?? budgetPlans[0]
  }, [budgetPlans, activeBudgetPlanId])

  const totalIncome = useMemo(() => {
    if (settings.noIncomeDeclared && incomeSources.length === 0) return 0
    return calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
  }, [incomeSources, settings.baseCurrency, settings.noIncomeDeclared, exchangeRates])

  const totalPlanned = activePlan ? totalPlannedExpensesForPlan(activePlan) : 0
  const projectedSavings = totalIncome - totalPlanned

  const { result: evalResult, loading: evalLoading, error: evalError } = useBudgetPlanEval(
    activePlan,
    totalIncome,
    settings.baseCurrency
  )

  const chat = useBudgetPlannerChat(activePlan, totalIncome, settings.baseCurrency)

  const startRename = useCallback((plan: { id: string; name: string }) => {
    setEditingTabId(plan.id)
    setEditingName(plan.name)
  }, [])

  const commitRename = useCallback(() => {
    if (!editingTabId) return
    updateBudgetPlan(editingTabId, { name: editingName })
    setEditingTabId(null)
  }, [editingTabId, editingName, updateBudgetPlan])

  const handleAddPlan = useCallback(() => {
    const name = window.prompt(t.budgetPlanner.newPlanName, t.budgetPlanner.defaultPlanName)
    if (name === null) return
    addBudgetPlan(name.trim() || t.budgetPlanner.defaultPlanName)
  }, [addBudgetPlan, t.budgetPlanner])

  const tabLabels = useMemo(() => ({ addPlan: t.budgetPlanner.addPlan }), [t.budgetPlanner.addPlan])
  const rowLabels = useMemo(
    () => ({
      subcategories: t.budgetPlanner.subcategories,
      addSubcategory: t.budgetPlanner.addSubcategory,
      amount: t.budgetPlanner.amount,
      delete: t.budgetPlanner.delete,
      expandCategory: t.budgetPlanner.expandCategory,
      newCategoryName: t.budgetPlanner.newCategoryName,
      iconPlaceholder: t.budgetPlanner.iconPlaceholder,
    }),
    [t.budgetPlanner]
  )

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.nav.budgetSetup}
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        {budgetPlans.length > 0 ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <BudgetPlanTabs
                plans={budgetPlans}
                activeId={activeBudgetPlanId}
                editingTabId={editingTabId}
                editingName={editingName}
                onSelect={setActiveBudgetPlanId}
                onStartRename={startRename}
                onEditingNameChange={setEditingName}
                onCommitRename={commitRename}
                onAddPlan={handleAddPlan}
                labels={tabLabels}
              />
              {activePlan ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t.common.confirmDeleteGeneric)) deleteBudgetPlan(activePlan.id)
                  }}
                  className="flex items-center gap-2 text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)] shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  {t.budgetPlanner.deletePlan}
                </button>
              ) : null}
            </div>

            <BudgetPlannerSummary
              totalIncome={totalIncome}
              totalPlanned={totalPlanned}
              projectedSavings={projectedSavings}
              currency={settings.baseCurrency}
              labels={{
                totalIncome: t.budgetPlanner.totalIncome,
                totalPlanned: t.budgetPlanner.totalPlanned,
                projectedSavings: t.budgetPlanner.projectedSavings,
                projectedSavingsLine: t.budgetPlanner.projectedSavingsLine,
              }}
            />

            {activePlan ? (
              <BudgetPlannerCategories
                categories={activePlan.categories}
                labels={{
                  categoriesTitle: t.budgetPlanner.categoriesTitle,
                  addCategory: t.budgetPlanner.addCategory,
                  ...rowLabels,
                }}
                onAddCategory={() =>
                  addPlanCategory(activePlan.id, {
                    name: t.budgetPlanner.newCategoryName,
                    icon: '📦',
                    amount: 0,
                  })
                }
                onUpdateCategory={(categoryId, updates) =>
                  updatePlanCategory(activePlan.id, categoryId, updates)
                }
                onDeleteCategory={(categoryId) => deletePlanCategory(activePlan.id, categoryId)}
                onAddSubcategory={(categoryId) =>
                  addPlanSubcategory(activePlan.id, categoryId, { name: 'Subcategory', amount: 0 })
                }
                onUpdateSubcategory={(categoryId, subId, updates) =>
                  updatePlanSubcategory(activePlan.id, categoryId, subId, updates)
                }
                onDeleteSubcategory={(categoryId, subId) =>
                  deletePlanSubcategory(activePlan.id, categoryId, subId)
                }
              />
            ) : null}

            <BudgetPlannerAiEvalCard
              rating={evalResult?.rating ?? null}
              explanation={evalResult?.explanation ?? null}
              loading={evalLoading}
              error={evalError}
              labels={{
                title: t.budgetPlanner.aiEvalTitle,
                loading: t.budgetPlanner.aiEvalLoading,
                error: t.budgetPlanner.aiEvalError,
              }}
            />

            <BudgetPlannerChatPanel
              plan={activePlan}
              messages={chat.messages}
              input={chat.input}
              onInputChange={chat.setInput}
              onSend={() => void chat.handleSend()}
              loading={chat.loading}
              onApply={chat.applyFromMessage}
              scrollAnchorRef={chat.scrollAnchorRef}
              labels={{
                title: t.budgetPlanner.aiChatTitle,
                placeholder: t.budgetPlanner.aiChatPlaceholder,
                send: t.budgetPlanner.aiSend,
                apply: t.budgetPlanner.applySuggestion,
                applied: t.budgetPlanner.applied,
              }}
            />
          </>
        ) : (
          <p className="text-sm text-[var(--color-brand-text-muted)]">{t.budgetPlanner.noPlansHint}</p>
        )}
      </div>
    </div>
  )
}
