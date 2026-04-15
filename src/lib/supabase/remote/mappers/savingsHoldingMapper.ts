import type { SavingsHolding, Currency, SavingsBucket, SavingsSubtype } from '@/lib/store/types'
import type { SavingsHoldingRow, SavingsHoldingInsert } from '@/lib/supabase/remote/types'

function toDbAssetType(s: SavingsSubtype): SavingsHoldingInsert['asset_type'] {
  // DB enum: bank | cash | gold | crypto | stock | bond | real_estate | other | stablecoin
  if (s === 'stocks') return 'stock'
  return s as SavingsHoldingInsert['asset_type']
}

function fromDbAssetType(t: SavingsHoldingRow['asset_type']): SavingsSubtype {
  if (t === 'stock') return 'stocks'
  if (t === 'bond' || t === 'stablecoin') return 'other'
  return t as SavingsSubtype
}

export function savingsHoldingToRow(h: SavingsHolding, userId: string): SavingsHoldingInsert {
  return {
    id: h.id,
    user_id: userId,
    account_id: null,
    asset_symbol: h.name,
    asset_name: h.name,
    asset_type: toDbAssetType(h.subtype),
    quantity: h.amount,
    currency: h.currency,
    initial_amount: h.amount,
    current_value: h.amount,
    purchase_date: h.asOfDate ?? null,
    notes: h.notes ?? null,
    created_at: h.createdAt,
  }
}

export function savingsHoldingFromRow(row: SavingsHoldingRow): SavingsHolding {
  return {
    id: row.id,
    name: row.asset_name ?? row.asset_symbol,
    bucket: 'liquid' as SavingsBucket,
    subtype: fromDbAssetType(row.asset_type),
    amount: row.current_value ?? row.quantity,
    currency: row.currency as Currency,
    asOfDate: row.purchase_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
