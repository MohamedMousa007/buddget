import type { ExpenseCategory } from '@/lib/store/types'

/** Categories shown in the onboarding plan editor (order matches budget UX). */
export const ONBOARDING_PLAN_DISPLAY_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
]

export function shortPlanLine(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}
