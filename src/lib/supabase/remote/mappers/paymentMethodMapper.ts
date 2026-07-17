import type { PaymentMethod, Currency } from '@/lib/store/types'
import type { PaymentMethodRow, PaymentMethodInsert } from '@/lib/supabase/remote/types'
import { normalizePaymentMethodType } from '@/lib/payment/paymentMethodDefaults'

export function paymentMethodToRow(pm: PaymentMethod, userId: string): PaymentMethodInsert {
  return {
    id: pm.id,
    user_id: userId,
    name: pm.name,
    type: pm.type,
    currency: pm.currency,
    color: pm.color ?? '#A3A3A3',
    is_default: pm.isDefault,
    last4: pm.last4 ?? null,
    notes: null,
  }
}

export function paymentMethodFromRow(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    type: normalizePaymentMethodType(row.type),
    currency: row.currency as Currency,
    color: row.color ?? undefined,
    last4: row.last4 ?? undefined,
    isDefault: row.is_default,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}
