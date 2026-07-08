import type { IncomeEvent, Currency, IncomeSourceType, IncomeEventStatus } from '@/lib/store/types'
import type { IncomeEventRow, IncomeEventInsert } from '@/lib/supabase/remote/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

/** Domain IncomeSourceType is wider than the DB enum; alias side_hustle → freelance. */
function toDbSourceType(s: IncomeSourceType | undefined): IncomeEventInsert['source_type'] {
  if (!s) return 'other'
  if (s === 'side_hustle') return 'freelance'
  return s as IncomeEventInsert['source_type']
}

function fromDbSourceType(s: IncomeEventRow['source_type']): IncomeSourceType {
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

export function incomeEventToRow(e: IncomeEvent, userId: string): IncomeEventInsert {
  return {
    id: e.id,
    user_id: userId,
    template_id: e.templateId ?? null,
    name: e.name,
    amount: e.amount,
    currency: e.currency,
    source_type: toDbSourceType(e.sourceType),
    received_date: e.receivedDate,
    status: e.status,
    payment_method_id:
      e.paymentMethodId && e.paymentMethodId !== DEFAULT_CASH_ID ? e.paymentMethodId : null,
    linked_savings_account_id: e.linkedSavingsAccountId ?? null,
    linked_debt_id: e.linkedDebtId ?? null,
    shared_plan_id: e.sharedPlanId ?? null,
    sms_log_id: e.smsLogId ?? null,
    notes: e.notes ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }
}

export function incomeEventFromRow(row: IncomeEventRow): IncomeEvent {
  return {
    id: row.id,
    templateId: row.template_id ?? undefined,
    name: row.name,
    amount: row.amount,
    currency: row.currency as Currency,
    sourceType: fromDbSourceType(row.source_type),
    receivedDate: row.received_date,
    status: row.status as IncomeEventStatus,
    paymentMethodId: row.payment_method_id ?? undefined,
    linkedSavingsAccountId: row.linked_savings_account_id ?? undefined,
    linkedDebtId: row.linked_debt_id ?? undefined,
    sharedPlanId: row.shared_plan_id ?? undefined,
    smsLogId: row.sms_log_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  }
}
