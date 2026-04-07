'use client'

import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AppSettings, BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { BudgetPlannerCategoryRow } from '@/components/features/budget-planner/BudgetPlannerCategoryRow'
import { BuddgyRebuildPrompt } from '@/components/features/budget-planner/BuddgyRebuildPrompt'
import { BudgetPlannerAddCategoryMenu } from '@/components/features/budget-planner/BudgetPlannerAddCategoryMenu'
import { BuddgyFlow } from '@/components/features/budget-planner/BuddgyFlow'

export interface BudgetPlannerCategoriesLabels {
  categoriesTitle: string
  addCategory: string
  chooseCategoryTitle: string
  customCategoryOption: string
  addCustomCategory: string
  editCategoryName: string
  subcategories: string
  addSubcategory: string
  amount: string
  delete: string
  expandCategory: string
  categoryNamePlaceholder: string
  categoryNameExample: string
  subcategoryNamePlaceholder: string
  amountPlaceholder: string
  emojiPickerLabel: string
}

export interface BudgetPlannerCategoriesProps {
  planId: string
  categories: BudgetPlanCategory[]
  settings: AppSettings
  labels: BudgetPlannerCategoriesLabels
  onUpdateCategory: (
    categoryId: string,
    updates: Partial<Omit<BudgetPlanCategory, 'id' | 'subcategories'>> & {
      subcategories?: BudgetPlanSubcategory[]
    }
  ) => void
  onDeleteCategory: (categoryId: string) => void
  onAddSubcategory: (categoryId: string) => void
  onUpdateSubcategory: (
    categoryId: string,
    subId: string,
    updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>
  ) => void
  onDeleteSubcategory: (categoryId: string, subId: string) => void
  onAddPresetCategory: (icon: string, name: string) => void
  onAddCustomCategory: (name: string, icon: string) => void
}

/** List of plan categories + add menu (predefined or custom), with optional Buddgy guided flow. */
export function BudgetPlannerCategories({
  planId,
  categories,
  settings,
  labels,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onAddPresetCategory,
  onAddCustomCategory,
}: BudgetPlannerCategoriesProps) {
  const t = useT()
  const { user, openAuthModal } = useAuth()
  const updateBudgetPlan = useFinanceStore((s) => s.updateBudgetPlan)
  const { budgetPlans, incomeSources, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      budgetPlans: s.budgetPlans,
      incomeSources: s.incomeSources,
      exchangeRates: s.exchangeRates,
    }))
  )
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )

  const [flowOpen, setFlowOpen] = useState(false)
  const [flowMode, setFlowMode] = useState<'resume' | 'restart'>('resume')
  const [flowKey, setFlowKey] = useState(0)
  const [rebuildPromptOpen, setRebuildPromptOpen] = useState(false)

  const planRow = budgetPlans.find((p) => p.id === planId)
  const monthlyIncome = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
  const needsRebuildConfirm =
    categories.length > 0 &&
    (monthlyIncome > 0.0001 || Boolean(planRow?.buddgyGuidedComplete))

  const rowLabels = {
    subcategories: labels.subcategories,
    addSubcategory: labels.addSubcategory,
    amount: labels.amount,
    delete: labels.delete,
    expandCategory: labels.expandCategory,
    categoryNamePlaceholder: labels.categoryNamePlaceholder,
    categoryNameExample: labels.categoryNameExample,
    subcategoryNamePlaceholder: labels.subcategoryNamePlaceholder,
    amountPlaceholder: labels.amountPlaceholder,
    emojiPickerLabel: labels.emojiPickerLabel,
    chooseCategoryTitle: labels.chooseCategoryTitle,
    customCategoryOption: labels.customCategoryOption,
    editCategoryName: labels.editCategoryName,
  }

  const menuLabels = {
    addCategory: labels.addCategory,
    chooseCategoryTitle: labels.chooseCategoryTitle,
    customCategoryOption: labels.customCategoryOption,
    addCustomCategory: labels.addCustomCategory,
    categoryNamePlaceholder: labels.categoryNamePlaceholder,
    categoryNameExample: labels.categoryNameExample,
    emojiPickerLabel: labels.emojiPickerLabel,
  }

  const restartGuidedWizardInPlace = useCallback(() => {
    updateBudgetPlan(planId, { buddgyGuidedComplete: false, buddgyFlow: null })
    setFlowKey((k) => k + 1)
    setFlowMode('restart')
  }, [updateBudgetPlan, planId])

  const startBuddgy = useCallback(
    (mode: 'resume' | 'restart') => {
      if (supabaseConfigured && !user) {
        openAuthModal('/budget-setup', t.modals.requireAuthBudgetSetup)
        return
      }
      if (mode === 'restart') {
        updateBudgetPlan(planId, { buddgyGuidedComplete: false, buddgyFlow: null })
        setFlowKey((k) => k + 1)
      }
      setFlowMode(mode)
      setFlowOpen(true)
    },
    [supabaseConfigured, user, openAuthModal, t.modals.requireAuthBudgetSetup, updateBudgetPlan, planId]
  )

  const onRebuildClick = useCallback(() => {
    if (supabaseConfigured && !user) {
      openAuthModal('/budget-setup', t.modals.requireAuthBudgetSetup)
      return
    }
    if (needsRebuildConfirm) {
      setRebuildPromptOpen(true)
      return
    }
    startBuddgy('restart')
  }, [supabaseConfigured, user, openAuthModal, needsRebuildConfirm, startBuddgy, t.modals.requireAuthBudgetSetup])

  return (
    <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {labels.categoriesTitle}
          </h2>
        </div>
        {!flowOpen ?
          <BudgetPlannerAddCategoryMenu
            categories={categories}
            onSelectPreset={(p) => onAddPresetCategory(p.icon, p.label)}
            onAddCustom={(name, icon) => onAddCustomCategory(name, icon)}
            labels={menuLabels}
          />
        : null}
      </div>

      {flowOpen ?
        <BuddgyFlow
          key={`${planId}-${flowKey}`}
          planId={planId}
          mode={flowMode}
          onClose={() => setFlowOpen(false)}
          onRestartWizard={restartGuidedWizardInPlace}
        />
      : categories.length === 0 ?
        <div className="space-y-3 py-6">
          <p className="text-sm text-[var(--color-brand-text-muted)]">No categories yet.</p>
          <button
            type="button"
            onClick={() => startBuddgy('resume')}
            className="text-sm text-brand-gold hover:underline cursor-pointer text-left"
          >
            ✨ Let Buddgy set it up for you
          </button>
        </div>
      : <>
          <div className="flex flex-col items-end gap-2 pb-1">
            {rebuildPromptOpen ?
              <BuddgyRebuildPrompt
                monthlyIncome={monthlyIncome}
                baseCurrency={settings.baseCurrency}
                onContinue={() => {
                  startBuddgy('restart')
                  setRebuildPromptOpen(false)
                }}
                onCancel={() => setRebuildPromptOpen(false)}
              />
            : <button
                type="button"
                onClick={onRebuildClick}
                className="text-sm text-brand-gold hover:underline cursor-pointer"
              >
                ✨ Ask Buddgy to rebuild your plan
              </button>}
          </div>
          <div className="space-y-2">
            {categories.map((c) => (
              <BudgetPlannerCategoryRow
                key={c.id}
                category={c}
                planCategories={categories}
                settings={settings}
                labels={rowLabels}
                onUpdateCategory={(u) => onUpdateCategory(c.id, u)}
                onDeleteCategory={() => onDeleteCategory(c.id)}
                onAddSubcategory={() => onAddSubcategory(c.id)}
                onUpdateSubcategory={(subId, u) => onUpdateSubcategory(c.id, subId, u)}
                onDeleteSubcategory={(subId) => onDeleteSubcategory(c.id, subId)}
              />
            ))}
          </div>
        </>
      }
    </div>
  )
}
