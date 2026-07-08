import type { PaymentMethod, Currency, PaymentMethodType } from '@/lib/store/types'
import type { PaymentMethodRow, PaymentMethodInsert } from '@/lib/supabase/remote/types'

export function paymentMethodToRow(pm: PaymentMethod, userId: string): PaymentMethodInsert {
  return {
    id: pm.id,
    user_id: userId,
    name: pm.name,
    type: pm.type,
    currency: pm.currency,
    color: pm.color ?? '#A3A3A3',
    is_default: pm.isDefault,
    // balance intentionally omitted: the SMS path owns it (createSmsExpense). Emitting it
    // here would reset the DB balance to 0 on every sync push. New rows default to 0.
    last4: pm.last4 ?? null,
    notes: null,
  }
}

export function paymentMethodFromRow(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    type: row.type as PaymentMethodType,
    currency: row.currency as Currency,
    color: row.color ?? undefined,
    last4: row.last4 ?? undefined,
    isDefault: row.is_default,
  }
}
