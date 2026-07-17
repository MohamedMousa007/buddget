import type { Goal, Currency, GoalCategory, GoalStatus } from '@/lib/store/types'
import type { GoalRow, GoalInsert } from '@/lib/supabase/remote/types'

/**
 * The DB enum now carries all 16 categories (migration 0092), so this is 1:1 apart from
 * three historical name differences (emergency_fund↔emergency, house↔home, custom↔other).
 * The seven that used to collapse to 'other' — phone_device, family_support,
 * sadaqah_charity, gift, investment, debt_freedom, quality_of_life — now round-trip intact.
 */
const TO_DB: Partial<Record<GoalCategory, GoalInsert['category']>> = {
  emergency_fund: 'emergency',
  house: 'home',
  custom: 'other',
}
const FROM_DB: Partial<Record<string, GoalCategory>> = {
  emergency: 'emergency_fund',
  home: 'house',
  other: 'custom',
}

function toDbCategory(c: GoalCategory): GoalInsert['category'] {
  return TO_DB[c] ?? (c as GoalInsert['category'])
}

function fromDbCategory(c: GoalRow['category']): GoalCategory {
  return FROM_DB[c] ?? (c as GoalCategory)
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
