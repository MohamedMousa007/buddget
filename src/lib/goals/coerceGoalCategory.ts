import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import type { GoalCategory } from '@/lib/store/types'

const ALLOWED = new Set<string>(GOAL_CATEGORIES.map((g) => g.value))

/** Maps AI / user text to a `GoalCategory`; falls back to `custom`. */
export function coerceGoalCategory(raw: unknown): GoalCategory {
  const x = String(raw ?? 'custom')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
  if (ALLOWED.has(x)) return x as GoalCategory
  return 'custom'
}
