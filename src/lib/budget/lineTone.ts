import { categoryChipColors } from '@/lib/expenses/categoryChip'
import type { BudgetPlanCategory } from '@/lib/store/types'

const NEUTRAL_BG = categoryChipColors('').bg

/** Bill names that are not ledger categories but read as one (Light touch `s_line`: Internet wears Utilities). */
const ALIASES: Record<string, string> = {
  bills: 'Utilities', internet: 'Utilities', electricity: 'Utilities', water: 'Utilities', gas: 'Utilities',
  phone: 'Utilities', telecom: 'Utilities', mobile: 'Utilities',
  housing: 'Rent', mortgage: 'Rent',
  dining: 'Food', restaurants: 'Food',
  car: 'Transport', fuel: 'Transport',
  gym: 'Health', medical: 'Health',
}

const known = (c: string) => categoryChipColors(c).bg !== NEUTRAL_BG

/**
 * The ledger category whose icon and tone a budget line wears: its name when that is a known category (Rent, Food,
 * Utilities) or a common bill name, else the first of its own categories that is. Null when none is known: the line
 * keeps its own icon.
 */
export function lineToneCategory(line: Pick<BudgetPlanCategory, 'name' | 'expenseCategories'>): string | null {
  const name = line.name.trim()
  if (name && known(name)) return name
  const alias = ALIASES[name.toLowerCase()]
  if (alias) return alias
  return (line.expenseCategories ?? []).find((c) => c && known(c)) ?? null
}
