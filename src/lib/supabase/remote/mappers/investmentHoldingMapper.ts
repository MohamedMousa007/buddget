import type { Currency, GoldKarat, InvestmentAssetType, InvestmentHolding } from '@/lib/store/types'
import type { SavingsHoldingRow, SavingsHoldingInsert } from '@/lib/supabase/remote/types'

// DB savings_type enum ↔ v3 asset type ('stock' in DB vs 'stock' here; 'real_estate' ↔ 'property').
function toDbAssetType(t: InvestmentAssetType): SavingsHoldingInsert['asset_type'] {
  return t === 'property' ? 'real_estate' : t
}
function fromDbAssetType(t: SavingsHoldingRow['asset_type']): InvestmentAssetType {
  if (t === 'real_estate') return 'property'
  if (t === 'crypto' || t === 'gold' || t === 'stock') return t === 'stock' ? 'stock' : t
  return 'stock'
}

interface HoldingMeta {
  goldUnit?: InvestmentHolding['goldUnit']
  sharePercent?: number
  rentedOut?: boolean
  areaPricePerM2?: number
  location?: string
}

export function investmentHoldingToRow(h: InvestmentHolding, userId: string): SavingsHoldingInsert {
  const metadata: HoldingMeta = {}
  if (h.goldUnit) metadata.goldUnit = h.goldUnit
  if (h.sharePercent != null) metadata.sharePercent = h.sharePercent
  if (h.rentedOut != null) metadata.rentedOut = h.rentedOut
  if (h.areaPricePerM2 != null) metadata.areaPricePerM2 = h.areaPricePerM2
  if (h.location) metadata.location = h.location

  return {
    id: h.id,
    user_id: userId,
    account_id: null,
    asset_symbol: h.symbol ?? (h.assetType === 'gold' ? `XAU_${h.karat ?? 24}K` : ''),
    asset_name: h.name,
    asset_type: toDbAssetType(h.assetType),
    quantity: h.quantity,
    currency: h.currency,
    unit_cost: h.unitCost ?? null,
    cost_basis_currency: h.costBasisCurrency ?? null,
    karat: h.karat ?? null,
    karat_unconfirmed: h.karatUnconfirmed ?? false,
    // Property's typed market value lives in current_value; other types value from live prices.
    current_value: h.assetType === 'property' ? h.propertyValue ?? null : null,
    purchase_date: h.purchaseDate ?? null,
    notes: h.notes ?? null,
    metadata: metadata as SavingsHoldingInsert['metadata'],
    created_at: h.createdAt,
  }
}

export function investmentHoldingFromRow(row: SavingsHoldingRow): InvestmentHolding {
  const meta = (row.metadata ?? {}) as HoldingMeta
  const assetType = fromDbAssetType(row.asset_type)
  return {
    id: row.id,
    assetType,
    name: row.asset_name ?? row.asset_symbol,
    quantity: row.quantity,
    currency: row.currency as Currency,
    purchaseDate: row.purchase_date ?? undefined,
    unitCost: row.unit_cost ?? undefined,
    costBasisCurrency: (row.cost_basis_currency as Currency | null) ?? undefined,
    notes: row.notes ?? undefined,
    karat: (row.karat as GoldKarat | null) ?? undefined,
    karatUnconfirmed: row.karat_unconfirmed ?? undefined,
    goldUnit: meta.goldUnit,
    symbol: row.asset_symbol || undefined,
    propertyValue: assetType === 'property' ? row.current_value ?? undefined : undefined,
    sharePercent: meta.sharePercent,
    rentedOut: meta.rentedOut,
    areaPricePerM2: meta.areaPricePerM2,
    location: meta.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}
