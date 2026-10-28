import type { GoalCategory } from '@/lib/store/types'
import { catalogCopyEn } from '@/lib/i18n/catalogCopy'

/** Suggested default title when picking a category (user can edit). Pass the dictionary's names to show it translated. */
export function defaultGoalName(category: GoalCategory, names: Record<GoalCategory, string> = catalogCopyEn.goalNames): string {
  return names[category] ?? names.custom
}
