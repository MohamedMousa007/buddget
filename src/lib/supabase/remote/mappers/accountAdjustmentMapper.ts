import type { AccountAdjustment } from '@/lib/store/types'
import type { Database } from '@/lib/supabase/database.types'

type AdjRow = Database['public']['Tables']['account_adjustments']['Row']
type AdjInsert = Database['public']['Tables']['account_adjustments']['Insert']

export function accountAdjustmentToRow(a: AccountAdjustment, userId: string): AdjInsert {
  return {
    id: a.id, user_id: userId, payment_method_id: a.paymentMethodId, delta: a.delta, reason: a.reason,
    occurred_at: a.occurredAt, note: a.note ?? null, created_at: a.createdAt, updated_at: a.updatedAt,
  }
}

export function accountAdjustmentFromRow(row: AdjRow): AccountAdjustment {
  return {
    id: row.id, paymentMethodId: row.payment_method_id, delta: row.delta,
    reason: row.reason as AccountAdjustment['reason'], occurredAt: row.occurred_at,
    note: row.note ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
