'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { totalPlannedExpensesForPlan } from '@/lib/budget/budgetPlans'
import { useBudgetPlanEval } from '@/hooks/useBudgetPlanEval'
import { useBudgetPlannerChat } from '@/hooks/useBudgetPlannerChat'

/**
 * Budget setup route: plans, income/planned totals, AI eval + chat, guest auth gating.
 */
export function useBudgetSetupPage() {
  const t = useT()
  const { user, loading: authLoading, openAuthModal } = useAuth()
  const supabaseConfigured = useMemo(
    () =>
      !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
      ),
    []
  )
  const isGuest = supabaseConfigured && !user
  const guestAuthPromptedRef = useRef(false)

  useEffect(() => {
    if (!supabaseConfigured || authLoading) return
    if (user) {
      guestAuthPromptedRef.current = false
      return
    }
    if (guestAuthPromptedRef.current) return
    guestAuthPromptedRef.current = true
    openAuthModal('/budget-setup', t.modals.requireAuthBudgetSetup)
  }, [supabaseConfigured, authLoading, user, openAuthModal, t.modals.requireAuthBudgetSetup])

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
    return calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
  }, [incomeSources, settings.baseCurrency, settings.noIncomeDeclared, exchangeRates])

  const totalPlanned = activePlan ? totalPlannedExpensesForPlan(activePlan) : 0
  const projectedSavings = totalIncome - totalPlanned

  const evalHook = useBudgetPlanEval(activePlan, totalIncome, settings.baseCurrency)
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
    if (isGuest) {
      openAuthModal('/budget-setup', t.modals.requireAuthBudgetSetup)
      return
    }
    const name = window.prompt(t.budgetPlanner.newPlanName, t.budgetPlanner.defaultPlanName)
    if (name === null) return
    addBudgetPlan(name.trim() || t.budgetPlanner.defaultPlanName)
  }, [addBudgetPlan, isGuest, openAuthModal, t.budgetPlanner, t.modals.requireAuthBudgetSetup])

  const tabLabels = useMemo(() => ({ addPlan: t.budgetPlanner.addPlan }), [t.budgetPlanner.addPlan])

  const categoryLabels = useMemo(
    () => ({
      categoriesTitle: t.budgetPlanner.categoriesTitle,
      addCategory: t.budgetPlanner.addCategory,
      chooseCategoryTitle: t.budgetPlanner.chooseCategoryTitle,
      customCategoryOption: t.budgetPlanner.customCategoryOption,
      addCustomCategory: t.budgetPlanner.addCustomCategory,
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
    evalResult: evalHook.result,
    evalLoading: evalHook.loading,
    evalError: evalHook.error,
    chat,
    editingTabId,
    editingName,
    setEditingName,
    startRename,
    commitRename,
    handleAddPlan,
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
