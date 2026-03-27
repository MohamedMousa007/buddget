'use client'

import { useState } from 'react'
import { Target, Pencil } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { calculateMonthlyIncome, effectiveCategoryBudget } from '@/lib/utils/calculations'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ExpenseCategory } from '@/lib/store/types'

export function ProfileBudgetSection() {
  const store = useFinanceStore()
  const [editingBudget, setEditingBudget] = useState<ExpenseCategory | null>(null)
  const [budgetInput, setBudgetInput] = useState('')

  const monthlyIncome = calculateMonthlyIncome(
    store.incomeSources,
    store.settings.baseCurrency,
    store.exchangeRates
  )
  const budgetMode = store.settings.budgetEntryMode ?? 'amount'

  const handleBudgetSave = (category: ExpenseCategory) => {
    const raw = parseFloat(budgetInput)
    if (Number.isNaN(raw) || raw < 0) {
      setEditingBudget(null)
      setBudgetInput('')
      return
    }
    if (budgetMode === 'percent_of_income') {
      const pct = Math.min(100, Math.max(0, raw))
      const derived = monthlyIncome > 0 ? (pct / 100) * monthlyIncome : 0
      store.updateBudgetCategory(category, derived, pct)
    } else {
      store.updateBudgetCategory(category, raw, null)
    }
    setEditingBudget(null)
    setBudgetInput('')
  }

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Budget</h2>
      </div>
      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        All budget numbers are in <strong className="text-white">{store.settings.baseCurrency}</strong> (primary currency).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => store.updateSettings({ budgetEntryMode: 'amount' })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            budgetMode === 'amount'
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
          }`}
        >
          Fixed amounts
        </button>
        <button
          type="button"
          onClick={() => store.updateSettings({ budgetEntryMode: 'percent_of_income' })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            budgetMode === 'percent_of_income'
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
          }`}
        >
          % of monthly income
        </button>
      </div>
      {budgetMode === 'percent_of_income' && (
        <p className="text-[10px] text-[var(--color-brand-text-muted)]">
          Recurring income total (→ {store.settings.baseCurrency}):{' '}
          <span className="font-mono-numbers text-white">
            {formatCurrency(monthlyIncome, store.settings.baseCurrency)}
          </span>
          /mo. Category % should add up to ~100 for a full allocation.
        </p>
      )}
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Month starts on</Label>
        <select
          value={store.settings.monthStartDay}
          onChange={(e) => store.updateSettings({ monthStartDay: parseInt(e.target.value) })}
          className="mt-1 w-24 h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
              {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {store.budgetCategories.map((budget) => (
          <div
            key={budget.category}
            className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0"
          >
            <span className="text-sm text-white">{budget.category}</span>
            {editingBudget === budget.category ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-28 h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBudgetSave(budget.category)
                    if (e.key === 'Escape') setEditingBudget(null)
                  }}
                />
                <span className="text-[10px] text-[var(--color-brand-text-muted)]">
                  {budgetMode === 'percent_of_income' ? '%' : store.settings.baseCurrency}
                </span>
                <button
                  type="button"
                  onClick={() => handleBudgetSave(budget.category)}
                  className="text-xs text-[var(--color-brand-green)]"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingBudget(budget.category)
                  if (budgetMode === 'percent_of_income') {
                    const eff = effectiveCategoryBudget(budget, store.settings, monthlyIncome)
                    const pct =
                      budget.percentOfIncome ??
                      (monthlyIncome > 0 ? (eff / monthlyIncome) * 100 : 0)
                    setBudgetInput(pct.toFixed(1))
                  } else {
                    setBudgetInput(budget.budgetedAmount.toString())
                  }
                }}
                className="flex flex-col items-end gap-0.5 text-sm font-mono-numbers text-[var(--color-brand-text-secondary)] hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  {budgetMode === 'percent_of_income' ? (
                    <>
                      <span>{(budget.percentOfIncome ?? 0).toFixed(1)}%</span>
                      <span className="text-[10px] text-[var(--color-brand-text-muted)]">
                        (
                        {formatCurrency(
                          effectiveCategoryBudget(budget, store.settings, monthlyIncome),
                          store.settings.baseCurrency,
                          false
                        )}
                        )
                      </span>
                    </>
                  ) : (
                    formatCurrency(budget.budgetedAmount, store.settings.baseCurrency, false)
                  )}
                  <Pencil className="w-3 h-3 opacity-50" />
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
