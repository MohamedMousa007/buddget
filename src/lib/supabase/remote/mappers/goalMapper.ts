import type { Goal, Currency, GoalCategory, GoalStatus } from '@/lib/store/types'
import type { GoalRow, GoalInsert } from '@/lib/supabase/remote/types'

/** Domain category list is wider than the DB enum; map + fallback. */
function toDbCategory(c: GoalCategory): GoalInsert['category'] {
  // DB enum: spending_control | emergency | vacation | home | car | education | wedding | retirement | other
  const map: Record<GoalCategory, GoalInsert['category']> = {
    emergency_fund: 'emergency',
    house: 'home',
    car: 'car',
    vacation: 'vacation',
    education: 'education',
    wedding: 'wedding',
    phone_device: 'other',
    family_support: 'other',
    sadaqah_charity: 'other',
    gift: 'other',
    investment: 'other',
    debt_freedom: 'other',
    quality_of_life: 'other',
    spending_control: 'spending_control',
    retirement: 'retirement',
    custom: 'other',
  }
  return map[c] ?? 'other'
}

function fromDbCategory(c: GoalRow['category']): GoalCategory {
  const map: Record<string, GoalCategory> = {
    spending_control: 'spending_control',
    emergency: 'emergency_fund',
    vacation: 'vacation',
    home: 'house',
    car: 'car',
    education: 'education',
    wedding: 'wedding',
    retirement: 'retirement',
    other: 'custom',
  }
  return map[c] ?? 'custom'
}

function toDbStatus(s: GoalStatus): GoalInsert['status'] {
  // DB enum: active | paused | achieved
  if (s === 'cancelled') return 'paused'
  return s
}

function fromDbStatus(s: GoalRow['status']): GoalStatus {
  return s as GoalStatus
}

export function goalToRow(g: Goal, userId: string): GoalInsert {
  return {
    id: g.id,
    user_id: userId,
    name: g.name,
    emoji: g.emoji,
    category: toDbCategory(g.category),
    target_amount: g.targetAmount,
    currency: g.currency,
    manual_current_amount: g.manualCurrentAmount,
    target_date: g.targetDate,
    linked_savings_account_ids: g.linkedSavingsAccountIds ?? [],
    linked_debt_ids: g.linkedDebtIds ?? [],
    monthly_spending_limit: g.monthlySpendingLimit,
    priority: g.priority,
    status: toDbStatus(g.status),
    monthly_contribution: g.monthlyContribution,
    notes: g.notes,
    achieved_at: g.achievedAt,
    created_at: g.createdAt,
  }
}

export function goalFromRow(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    category: fromDbCategory(row.category),
    targetAmount: row.target_amount,
    currency: row.currency as Currency,
    manualCurrentAmount: row.manual_current_amount,
    targetDate: row.target_date,
    linkedSavingsAccountIds: row.linked_savings_account_ids ?? [],
    linkedDebtIds: row.linked_debt_ids ?? [],
    monthlySpendingLimit: row.monthly_spending_limit,
    priority: row.priority,
    status: fromDbStatus(row.status),
    monthlyContribution: row.monthly_contribution,
    notes: row.notes,
    achievedAt: row.achieved_at,
    createdAt: row.created_at,
  }
}
