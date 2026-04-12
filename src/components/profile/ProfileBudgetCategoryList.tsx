'use client'

import { Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { effectiveCategoryBudget } from '@/lib/utils/calculations'
import { Input } from '@/components/ui/input'
import type { Dictionary } from '@/lib/i18n/types'
import type { AppSettings, BudgetCategory } from '@/lib/store/types'

export interface ProfileBudgetCategoryListProps {
  t: Dictionary['profile']
  budgetCategories: BudgetCategory[]
  settings: AppSettings
  budgetMode: 'amount' | 'percent_of_income'
  monthlyIncome: number
  editingBudget: string | null
  budgetInput: string
  setBudgetInput: (v: string) => void
  setEditingBudget: (v: string | null) => void
  onSave: (category: string) => void
}

/** Inline-editable rows for each budget category (fixed amount or % of income). */
export function ProfileBudgetCategoryList({
  t,
  budgetCategories,
  settings,
  budgetMode,
  monthlyIncome,
  editingBudget,
  budgetInput,
  setBudgetInput,
  setEditingBudget,
  onSave,
}: ProfileBudgetCategoryListProps) {
  return (
    <div className="space-y-2">
      {budgetCategories.map((budget) => (
        <div
          key={budget.category}
          className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0"
        >
          <span className="text-sm text-[var(--color-brand-text-primary)]">{budget.category}</span>
          {editingBudget === budget.category ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-28 h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave(budget.category)
                  if (e.key === 'Escape') setEditingBudget(null)
                }}
              />
              <span className="text-[10px] text-[var(--color-brand-text-muted)]">
                {budgetMode === 'percent_of_income' ? '%' : settings.baseCurrency}
              </span>
              <button
                type="button"
                onClick={() => onSave(budget.category)}
                className="text-xs text-[var(--color-brand-green)]"
              >
                {t.budgetSave}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingBudget(budget.category)
                if (budgetMode === 'percent_of_income') {
                  const eff = effectiveCategoryBudget(budget, settings, monthlyIncome)
                  const pct =
                    budget.percentOfIncome ?? (monthlyIncome > 0 ? (eff / monthlyIncome) * 100 : 0)
                  setBudgetInput(pct.toFixed(1))
                } else {
                  setBudgetInput(budget.budgetedAmount.toString())
                }
              }}
              className="flex flex-col items-end gap-0.5 text-sm font-mono-numbers text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors"
            >
              <span className="flex items-center gap-2">
                {budgetMode === 'percent_of_income' ? (
                  <>
                    <span>{(budget.percentOfIncome ?? 0).toFixed(1)}%</span>
                    <span className="text-[10px] text-[var(--color-brand-text-muted)]">
                      (
                      {formatCurrency(
                        effectiveCategoryBudget(budget, settings, monthlyIncome),
                        settings.baseCurrency,
                        false
                      )}
                      )
                    </span>
                  </>
                ) : (
                  formatCurrency(budget.budgetedAmount, settings.baseCurrency, false)
                )}
                <Pencil className="w-3 h-3 opacity-50" />
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
