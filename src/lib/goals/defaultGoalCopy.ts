import type { GoalCategory } from '@/lib/store/types'

/** Suggested default title when picking a category (user can edit). */
export function defaultGoalName(category: GoalCategory): string {
  const m: Record<GoalCategory, string> = {
    emergency_fund: 'Emergency Fund',
    house: 'House Down Payment',
    car: 'New Car',
    vacation: 'Vacation',
    education: 'Education',
    wedding: 'Wedding',
    phone_device: 'Phone / Device',
    family_support: 'Family Support',
    sadaqah_charity: 'Sadaqah',
    gift: 'Gift',
    investment: 'Investments',
    debt_freedom: 'Debt Freedom',
    quality_of_life: 'Quality of Life',
    spending_control: 'Spending Control',
    retirement: 'Retirement',
    custom: 'My Goal',
  }
  return m[category] ?? 'My Goal'
}
