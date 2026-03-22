import type { BudgetCategory, Currency, ExpenseCategory } from '@/lib/store/types'

export type BudgetPresetId = 'balanced' | 'savings_focus' | 'essentials' | 'debt_focus'

const ORDER: ExpenseCategory[] = [
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
]

/** Percent of monthly income per category (sums to 100). */
const PRESETS: Record<BudgetPresetId, Record<ExpenseCategory, number>> = {
  balanced: {
    Rent: 25,
    Transport: 10,
    Food: 18,
    Enjoyment: 10,
    Savings: 15,
    Debt: 12,
    Remittance: 5,
    Other: 5,
  },
  savings_focus: {
    Rent: 22,
    Transport: 8,
    Food: 15,
    Enjoyment: 5,
    Savings: 28,
    Debt: 12,
    Remittance: 5,
    Other: 5,
  },
  essentials: {
    Rent: 32,
    Transport: 12,
    Food: 22,
    Enjoyment: 5,
    Savings: 8,
    Debt: 10,
    Remittance: 6,
    Other: 5,
  },
  debt_focus: {
    Rent: 22,
    Transport: 8,
    Food: 15,
    Enjoyment: 5,
    Savings: 10,
    Debt: 28,
    Remittance: 7,
    Other: 5,
  },
}

export function budgetCategoriesFromPreset(
  presetId: BudgetPresetId,
  baseCurrency: Currency
): BudgetCategory[] {
  const p = PRESETS[presetId]
  return ORDER.map((category) => ({
    category,
    budgetedAmount: 0,
    currency: baseCurrency,
    percentOfIncome: p[category],
  }))
}

export function isBudgetPresetId(v: string): v is BudgetPresetId {
  return v === 'balanced' || v === 'savings_focus' || v === 'essentials' || v === 'debt_focus'
}
