import type { RecurringSavingsDeposit, Currency } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import type { RecurringSavingsDepositRow, RecurringSavingsDepositInsert } from '@/lib/supabase/remote/types'

export function recurringSavingsDepositToRow(
  r: RecurringSavingsDeposit,
  userId: string
): RecurringSavingsDepositInsert {
  return {
    id: r.id,
    user_id: userId,
    account_id: r.accountId,
    amount: r.amount,
    currency: r.currency,
    frequency: 'monthly',
    day_of_month: r.dayOfMonth,
    next_due_date: r.nextDueDate,
    is_active: r.isActive,
    notes: r.notes ?? null,
    created_at: r.createdAt,
  }
}

export function recurringSavingsDepositFromRow(
  row: RecurringSavingsDepositRow
): RecurringSavingsDeposit {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: row.amount,
    currency: row.currency as Currency,
    frequency: 'monthly',
    dayOfMonth: row.day_of_month ?? 1,
    nextDueDate: row.next_due_date ?? localTodayISO(),
    isActive: row.is_active,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}
