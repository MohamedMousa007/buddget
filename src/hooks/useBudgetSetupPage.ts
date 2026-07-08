'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { projectedIncomeForMonth } from '@/lib/utils/calculations'
import { totalPlannedExpensesForPlan } from '@/lib/budget/budgetPlans'

/**
 * Budget setup route: plans, income/planned totals.
 */
export function useBudgetSetupPage() {
  const t = useT()
  const { user } = useAuth()
  const supabaseConfigured = useMemo(() => isSupabaseConfigured(), [])

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

  const activePlan = useMemo(() => {
    if (budgetPlans.length === 0) return null
    return budgetPlans.find((p) => p.id === activeBudgetPlanId) ?? budgetPlans[0]
  }, [budgetPlans, activeBudgetPlanId])

  const totalIncome = useMemo(() => {
    if (settings.noIncomeDeclared && incomeSources.length === 0) return 0
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return projectedIncomeForMonth(
      incomeSources,
      settings.baseCurrency,
      exchangeRates,
      currentMonth,
      settings.monthStartDay
    )
  }, [incomeSources, settings.baseCurrency, settings.noIncomeDeclared, settings.monthStartDay, exchangeRates])

  const totalPlanned = activePlan
    ? totalPlannedExpensesForPlan(activePlan, settings.baseCurrency, exchangeRates)
    : 0
  const projectedSavings = totalIncome - totalPlanned

  const startRename = useCallback((plan: { id: string; name: string }) => {
    setEditingTabId(plan.id)
    setEditingName(plan.name)
  }, [])

  const commitRename = useCallback(() => {
    if (!editingTabId) return
    updateBudgetPlan(editingTabId, { name: editingName })
    setEditingTabId(null)
  }, [editingTabId, editingName, updateBudgetPlan])

  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')

  const handleAddPlan = useCallback(() => {
    setNewPlanName(t.budgetPlanner.defaultPlanName)
    setNewPlanDialogOpen(true)
  }, [t.budgetPlanner.defaultPlanName])

  const commitNewPlan = useCallback(() => {
    addBudgetPlan(newPlanName.trim() || t.budgetPlanner.defaultPlanName)
    setNewPlanDialogOpen(false)
    setNewPlanName('')
  }, [addBudgetPlan, newPlanName, t.budgetPlanner.defaultPlanName])

  const cancelNewPlan = useCallback(() => {
    setNewPlanDialogOpen(false)
    setNewPlanName('')
  }, [])

  const tabLabels = useMemo(() => ({ addPlan: t.budgetPlanner.addPlan }), [t.budgetPlanner.addPlan])

  const categoryLabels = useMemo(
    () => ({
      categoriesTitle: t.budgetPlanner.categoriesTitle,
      addCategory: t.budgetPlanner.addCategory,
      chooseCategoryTitle: t.budgetPlanner.chooseCategoryTitle,
      customCategoryOption: t.budgetPlanner.customCategoryOption,
      addCustomCategory: t.budgetPlanner.addCustomCategory,
      editCategoryName: t.budgetPlanner.editCategoryName,
      subcategories: t.budgetPlanner.subcategories,
      addSubcategory: t.budgetPlanner.addSubcategory,
      amount: t.budgetPlanner.amount,
      delete: t.budgetPlanner.delete,
      expandCategory: t.budgetPlanner.expandCategory,
      categoryNamePlaceholder: t.budgetPlanner.categoryNamePlaceholder,
      categoryNameExample: t.budgetPlanner.categoryNameExample,
      subcategoryNamePlaceholder: t.budgetPlanner.subcategoryNamePlaceholder,
      amountPlaceholder: t.budgetPlanner.amountPlaceholder,
      emojiPickerLabel: t.budgetPlanner.emojiPickerLabel,
      savingsAllocationBadge: t.budgetPlanner.savingsAllocationBadge,
    }),
    [t.budgetPlanner]
  )

  return {
    t,
    supabaseConfigured,
    user,
    budgetPlans,
    activeBudgetPlanId,
    activePlan,
    settings,
    totalIncome,
    totalPlanned,
    projectedSavings,
    editingTabId,
    editingName,
    setEditingName,
    startRename,
    commitRename,
    handleAddPlan,
    newPlanDialogOpen,
    newPlanName,
    setNewPlanName,
    commitNewPlan,
    cancelNewPlan,
    setActiveBudgetPlanId,
    deleteBudgetPlan,
    updateBudgetPlan,
    tabLabels,
    categoryLabels,
    addPlanCategory,
    updatePlanCategory,
    deletePlanCategory,
    addPlanSubcategory,
    updatePlanSubcategory,
    deletePlanSubcategory,
  }
}
