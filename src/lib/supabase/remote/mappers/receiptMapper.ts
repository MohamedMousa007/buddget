import type { Receipt, ReceiptItem, ReceiptCharge, Currency } from '@/lib/store/types'
import type { ReceiptRow, ReceiptInsert } from '@/lib/supabase/remote/types'
import type { Json } from '@/lib/supabase/database.types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { toDbExpenseCategory } from './expenseCategoryCoercion'

function toDbCategory(category: string): ReceiptInsert['category'] {
  return toDbExpenseCategory(category, 'Other')
}

const CHARGE_TYPES: readonly ReceiptCharge['type'][] = ['tax', 'service', 'tip', 'discount', 'other']

function normaliseItems(raw: unknown): ReceiptItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name : ''
    const price = typeof e.price === 'number' && Number.isFinite(e.price) ? e.price : 0
    const qty = typeof e.qty === 'number' && Number.isFinite(e.qty) ? e.qty : undefined
    return [{ name, price, ...(qty != null ? { qty } : {}) }]
  })
}

function normaliseCharges(raw: unknown): ReceiptCharge[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const e = entry as Record<string, unknown>
    const type = CHARGE_TYPES.includes(e.type as ReceiptCharge['type']) ? (e.type as ReceiptCharge['type']) : 'other'
    const label = typeof e.label === 'string' ? e.label : ''
    const amount = typeof e.amount === 'number' && Number.isFinite(e.amount) ? e.amount : 0
    return [{ type, label, amount }]
  })
}

export function receiptToRow(r: Receipt, userId: string): ReceiptInsert {
  return {
    id: r.id,
    user_id: userId,
    merchant: r.merchant || null,
    amount: r.amount,
    currency: r.currency,
    receipt_date: r.receiptDate,
    category: toDbCategory(r.category),
    payment_method_id:
      r.paymentMethodId && r.paymentMethodId !== DEFAULT_CASH_ID ? r.paymentMethodId : null,
    confidence: r.confidence ?? null,
    items: r.items as unknown as Json,
    charges: r.charges as unknown as Json,
    notes: r.notes ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }
}

export function receiptFromRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    merchant: row.merchant ?? '',
    amount: row.amount,
    currency: row.currency as Currency,
    receiptDate: row.receipt_date,
    category: row.category as string,
    paymentMethodId: row.payment_method_id ?? undefined,
    confidence: row.confidence ?? undefined,
    items: normaliseItems(row.items),
    charges: normaliseCharges(row.charges),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
