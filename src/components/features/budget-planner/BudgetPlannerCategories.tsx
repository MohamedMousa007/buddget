'use client'

import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AppSettings, BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { Bot, Plus, RefreshCcw } from 'lucide-react'
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
    <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-6 space-y-4">
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
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-elevated)] to-[var(--color-brand-card)] p-5 space-y-4 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-[var(--color-brand-red)]/10 p-3">
              <Bot className="h-6 w-6 text-[var(--color-brand-red)]" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
              Meet Buddgy, your financial expert buddy
            </p>
            <p className="text-xs text-[var(--color-brand-text-secondary)]">
              Buddgy will build a personalized budget plan based on your income and lifestyle.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => startBuddgy('resume')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
            >
              <Bot className="h-4 w-4" />
              Let Buddgy build my plan
            </button>
            <button
              type="button"
              onClick={() => {
                const menu = document.querySelector<HTMLButtonElement>('[data-add-category-trigger]')
                menu?.click()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add category manually
            </button>
          </div>
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Rebuild with Buddgy
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
