'use client'

import { useState } from 'react'
import { Target } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { useT } from '@/lib/i18n'
import type { ExpenseCategory } from '@/lib/store/types'
import { ProfileBudgetCategoryList } from '@/components/profile/ProfileBudgetCategoryList'
import { ProfileBudgetModeAndCalendar } from '@/components/profile/ProfileBudgetModeAndCalendar'

export interface ProfileBudgetSectionProps {
  /** Use `embedded` inside another card (e.g. dashboard) to avoid nested glass surfaces. */
  variant?: 'standalone' | 'embedded'
}

export function ProfileBudgetSection({ variant = 'standalone' }: ProfileBudgetSectionProps) {
  const t = useT()
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

  const sectionClass =
    variant === 'embedded' ? 'space-y-4 pt-1' : 'glass-card rounded-2xl p-5 space-y-4'

  return (
    <section className={sectionClass}>
      {variant === 'standalone' ? (
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-[var(--color-brand-red)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {t.profile.budgetTitle}
          </h2>
        </div>
      ) : null}
      <ProfileBudgetModeAndCalendar
        t={t.profile}
        baseCurrency={store.settings.baseCurrency}
        budgetMode={budgetMode}
        monthlyIncome={monthlyIncome}
        monthStartDay={store.settings.monthStartDay}
        onModeAmount={() => store.updateSettings({ budgetEntryMode: 'amount' })}
        onModePercent={() => store.updateSettings({ budgetEntryMode: 'percent_of_income' })}
        onMonthStartDay={(day) => store.updateSettings({ monthStartDay: day })}
      />
      <ProfileBudgetCategoryList
        t={t.profile}
        budgetCategories={store.budgetCategories}
        settings={store.settings}
        budgetMode={budgetMode}
        monthlyIncome={monthlyIncome}
        editingBudget={editingBudget}
        budgetInput={budgetInput}
        setBudgetInput={setBudgetInput}
        setEditingBudget={setEditingBudget}
        onSave={handleBudgetSave}
      />
    </section>
  )
}
