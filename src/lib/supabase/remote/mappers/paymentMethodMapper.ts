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
    last4_aliases: pm.last4Aliases ?? [],
    label: pm.label?.trim() || null,
    notes: null,
    parent_id: pm.parentId ?? null,
    opening_balance: pm.openingBalance ?? null,
    opening_at: pm.openingAt ?? null,
    closed_at: pm.closedAt ?? null,
    // Every account is checked against its bank messages; the choice was retired (see docs/ARCHIVED_FEATURES.md).
    track_sms: true,
    excluded: pm.excluded ?? false,
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
    last4Aliases: row.last4_aliases?.length ? row.last4_aliases : undefined,
    label: row.label ?? undefined,
    isDefault: row.is_default,
    parentId: row.parent_id ?? undefined,
    openingBalance: row.opening_balance ?? undefined,
    openingAt: row.opening_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    trackSms: true,
    excluded: row.excluded || undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.edited_at,
  }
}
