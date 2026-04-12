'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AppSettings, BudgetPlanCategory, BudgetPlanSubcategory, Currency } from '@/lib/store/types'
import { Bot, Plus, Sparkles } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { BuddgyBuilderOpenOptions } from '@/hooks/useBuddgyBuilderFlow'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { BudgetPlannerCategoryRow } from '@/components/features/budget-planner/BudgetPlannerCategoryRow'
import { BudgetPlannerAddCategoryMenu } from '@/components/features/budget-planner/BudgetPlannerAddCategoryMenu'
import { BuddgyBuilderFlow } from '@/components/features/budget-planner/BuddgyBuilderFlow'

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
  savingsAllocationBadge: string
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
  const { incomeSources, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      exchangeRates: s.exchangeRates,
    }))
  )
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )

  const [flowOpen, setFlowOpen] = useState(false)
  const [flowKey, setFlowKey] = useState(0)

  const monthlyIncome = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)

  const builderOptions = useMemo((): BuddgyBuilderOpenOptions => {
    const lines: string[] = []
    if (categories.length > 0) {
      if (monthlyIncome > 0.0001) {
        lines.push(
          `My monthly income is about ${Math.round(monthlyIncome)} ${settings.baseCurrency}.`
        )
      }
      const rent = categories.find((c) => c.name === 'Rent')
      if (rent && rent.amount > 0) {
        lines.push(`My rent is about ${rent.amount} per month.`)
      }
      lines.push('I want to rebuild my budget with Buddgy.')
    }
    return {
      initialDescribeText: lines.length > 0 ? lines.join(' ') : undefined,
      knownIncome:
        monthlyIncome > 0.0001 ?
          { amount: Math.round(monthlyIncome), currency: settings.baseCurrency as Currency }
        : undefined,
    }
  }, [categories, monthlyIncome, settings.baseCurrency])

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
    savingsAllocationBadge: labels.savingsAllocationBadge,
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

  const startBuddgy = useCallback(() => {
    if (supabaseConfigured && !user) {
      openAuthModal('/budget-setup', t.modals.requireAuthBudgetSetup)
      return
    }
    setFlowKey((k) => k + 1)
    setFlowOpen(true)
  }, [supabaseConfigured, user, openAuthModal, t.modals.requireAuthBudgetSetup])

  const showRebuild = !flowOpen && categories.length > 0

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
        <BuddgyBuilderFlow
          key={`${planId}-${flowKey}`}
          planId={planId}
          onClose={() => setFlowOpen(false)}
          builderOptions={builderOptions}
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
              onClick={startBuddgy}
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

          {showRebuild ?
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={startBuddgy}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand-amber)]" />
                Rebuild with Buddgy
              </button>
            </div>
          : null}
        </>
      }
    </div>
  )
}
