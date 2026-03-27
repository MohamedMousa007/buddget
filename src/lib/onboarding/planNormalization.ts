import type { ExpenseCategory } from '@/lib/store/types'

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

export function normalizeCategoryPercents(raw: Record<string, number>): Record<ExpenseCategory, number> {
  const base: Record<ExpenseCategory, number> = {
    Rent: 0,
    Transport: 0,
    Food: 0,
    Enjoyment: 0,
    Savings: 0,
    Debt: 0,
    Remittance: 0,
    Other: 0,
  }
  for (const k of ORDER) {
    const v = raw[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      base[k] = v
    }
  }
  const sum = ORDER.reduce((a, k) => a + base[k], 0)
  if (sum <= 0) {
    const eq = 100 / ORDER.length
    ORDER.forEach((k) => {
      base[k] = eq
    })
    return base
  }
  if (Math.abs(sum - 100) < 0.5) return base
  const scale = 100 / sum
  ORDER.forEach((k) => {
    base[k] = Math.round(base[k] * scale * 10) / 10
  })
  const drift = 100 - ORDER.reduce((a, k) => a + base[k], 0)
  base.Other = Math.max(0, Math.round((base.Other + drift) * 10) / 10)
  return base
}
