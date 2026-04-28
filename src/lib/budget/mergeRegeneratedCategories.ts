import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import { isSavingsCategoryRow } from '@/lib/budget/lifestyleMappings'
import type { Currency } from '@/lib/store/types'

/** Keys returned by `/api/budget/regenerate` Gemini schema. */
export const REGENERATE_CATEGORY_KEYS = [
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
] as const

export type RegenerateCategoryKey = (typeof REGENERATE_CATEGORY_KEYS)[number]

/** Map a plan row name to an aggregate bucket for AI amounts. */
export function regenerateBucketForRowName(name: string): RegenerateCategoryKey {
  const n = name.trim().toLowerCase()
  if (/rent|housing|mortgage|lease/.test(n)) return 'Rent'
  if (/transport|car|uber|taxi|fuel|petrol|parking|metro|bus/.test(n)) return 'Transport'
  if (/food|groc|dining|restaurant|meal/.test(n)) return 'Food'
  if (/fun|entertain|enjoy|hobby|netflix|spotify/.test(n)) return 'Enjoyment'
  if (/sav(e|ings)|emergency fund/.test(n)) return 'Savings'
  if (/debt|loan|installment|card|owe/.test(n)) return 'Debt'
  if (/remit|transfer abroad|family support/.test(n)) return 'Remittance'
  return 'Other'
}

/**
 * Splits each bucket total from the AI across existing rows in that bucket (proportional to prior amounts).
 */
export function mergeRegeneratedCategoryAmounts(
  currentRows: BudgetCategoryRow[],
  aiCategories: Partial<Record<RegenerateCategoryKey, number>>,
  baseCurrency: Currency,
): BudgetCategoryRow[] {
  if (currentRows.length === 0) return currentRows

  const bucketTotals: Record<RegenerateCategoryKey, number> = {
    Rent: 0,
    Transport: 0,
    Food: 0,
    Enjoyment: 0,
    Savings: 0,
    Debt: 0,
    Remittance: 0,
    Other: 0,
  }
  for (const k of REGENERATE_CATEGORY_KEYS) {
    const v = aiCategories[k]
    bucketTotals[k] =
      typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0
  }

  const bucketToIndices = new Map<RegenerateCategoryKey, number[]>()
  for (const k of REGENERATE_CATEGORY_KEYS) bucketToIndices.set(k, [])

  for (let i = 0; i < currentRows.length; i++) {
    const row = currentRows[i]!
    const key: RegenerateCategoryKey =
      isSavingsCategoryRow(row) ? 'Savings' : regenerateBucketForRowName(row.name)
    bucketToIndices.get(key)!.push(i)
  }

  const newAmounts: number[] = new Array(currentRows.length).fill(0)

  for (const k of REGENERATE_CATEGORY_KEYS) {
    const indices = bucketToIndices.get(k) ?? []
    const target = bucketTotals[k]
    if (indices.length === 0) continue

    const rows = indices.map((idx) => currentRows[idx]!)
    const prevSum = rows.reduce((s, r) => s + Math.max(0, r.amount), 0)

    if (prevSum <= 0) {
      const each = Math.round(target / indices.length)
      const leftover = target - each * indices.length
      indices.forEach((idx, j) => {
        const extra = j < leftover ? 1 : 0
        newAmounts[idx] = each + extra
      })
      continue
    }

    let assigned = 0
    indices.forEach((idx, j) => {
      const r = currentRows[idx]!
      const share = (target * Math.max(0, r.amount)) / prevSum
      const amt =
        j === indices.length - 1 ? Math.max(0, target - assigned) : Math.max(0, Math.round(share))
      assigned += amt
      newAmounts[idx] = amt
    })
  }

  return currentRows.map((r, i) => ({
    ...r,
    amount: newAmounts[i] ?? r.amount,
    currency: baseCurrency,
  }))
}
