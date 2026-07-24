import type { IncomeSource, Currency, IncomeSourceType, IncomeRecurringFrequency } from '@/lib/store/types'
import type { IncomeSourceRow, IncomeSourceInsert } from '@/lib/supabase/remote/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

/** Zustand IncomeSourceType is wider than the DB enum; map 1:1 for the overlapping values. */
function toDbSourceType(s: IncomeSourceType | undefined): IncomeSourceInsert['source_type'] {
  // DB enum: salary | freelance | business | rental | investment | debt | gift | refund | other
  //          | bonus | savings (added via ALTER later)
  // Legacy domain values: side_hustle
  if (!s) return 'other'
  if (s === 'side_hustle') return 'freelance'
  return s as IncomeSourceInsert['source_type']
}

/** DB → domain: inverse of above, with the same aliasing. */
function fromDbSourceType(s: IncomeSourceRow['source_type']): IncomeSourceType {
  // 'freelance' in DB maps back to 'other' only if it was originally 'other'. We have no way
  // to know, so we'll return the DB value directly; domain already accepts all overlapping values.
  const mapped: Record<string, IncomeSourceType> = {
    salary: 'salary',
    bonus: 'bonus',
    freelance: 'side_hustle',
    business: 'side_hustle',
    rental: 'other',
    investment: 'investment',
    debt: 'debt',
    gift: 'gift',
    refund: 'refund',
    other: 'other',
    savings: 'savings',
  }
  return mapped[s] ?? 'other'
}

export function incomeSourceToRow(i: IncomeSource, userId: string): IncomeSourceInsert {
  return {
    id: i.id,
    user_id: userId,
    name: i.name,
    source_type: toDbSourceType(i.sourceType),
    amount: i.amount,
    currency: i.currency,
    is_recurring: i.isRecurring,
    recurring_frequency:
      i.isRecurring && i.recurringFrequency ? (i.recurringFrequency as IncomeSourceInsert['recurring_frequency']) : null,
    day_of_month: i.dayOfMonth ?? null,
    payday_days: i.paydayDays ?? null,
    payday_drift_days: i.paydayDriftDays ?? null,
    effective_start: i.effectiveStart,
    effective_end: i.effectiveEnd ?? null,
    notes: i.notes ?? null,
    payment_method_id:
      i.paymentMethodId && i.paymentMethodId !== DEFAULT_CASH_ID ? i.paymentMethodId : null,
    linked_savings_account_id: i.linkedSavingsAccountId ?? null,
    linked_debt_id: i.linkedDebtId ?? null,
    shared_plan_id: i.sharedPlanId ?? null,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  }
}

export function incomeSourceFromRow(row: IncomeSourceRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency as Currency,
    isRecurring: row.is_recurring,
    recurringFrequency: row.recurring_frequency
      ? (row.recurring_frequency as IncomeRecurringFrequency)
      : undefined,
    dayOfMonth: row.day_of_month ?? undefined,
    paydayDays: row.payday_days ?? undefined,
    paydayDriftDays: row.payday_drift_days ?? undefined,
    effectiveStart: row.effective_start ?? row.created_at.slice(0, 10),
    effectiveEnd: row.effective_end ?? undefined,
    notes: row.notes ?? undefined,
    paymentMethodId: row.payment_method_id ?? undefined,
    linkedSavingsAccountId: row.linked_savings_account_id ?? undefined,
    linkedDebtId: row.linked_debt_id ?? undefined,
    sharedPlanId: row.shared_plan_id ?? undefined,
    sourceType: fromDbSourceType(row.source_type),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  }
}
