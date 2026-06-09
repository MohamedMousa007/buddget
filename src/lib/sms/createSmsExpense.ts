/**
 * Shared helper: promote a sms_parse_log row to an expense or income_source.
 * Used by both /api/sms/parse (auto-add) and /api/sms/confirm (user confirm).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SmsExpenseKind =
  | 'purchase' | 'online_purchase' | 'atm_withdrawal'
  | 'instant_transfer_out' | 'instant_transfer_in'
  | 'income' | 'refund' | 'fee' | 'other'
  | null

export type ExpenseCategory =
  | 'Rent' | 'Transport' | 'Food' | 'Enjoyment'
  | 'Savings' | 'Debt' | 'Remittance' | 'Other'

export function mapKindToCategory(
  kind: SmsExpenseKind,
  categoryHint: string | null,
): ExpenseCategory {
  if (kind === 'atm_withdrawal') return 'Other'
  if (kind === 'instant_transfer_out') return 'Remittance'
  const raw = (categoryHint ?? '').toLowerCase()
  if (raw.includes('rent') || raw.includes('housing')) return 'Rent'
  if (raw.includes('transport') || raw.includes('travel') || raw.includes('fuel') || raw.includes('uber')) return 'Transport'
  if (raw.includes('food') || raw.includes('restaurant') || raw.includes('grocery') || raw.includes('dining')) return 'Food'
  if (raw.includes('entertainment') || raw.includes('enjoyment') || raw.includes('leisure')) return 'Enjoyment'
  if (raw.includes('saving') || raw.includes('investment')) return 'Savings'
  if (raw.includes('debt') || raw.includes('loan') || raw.includes('instalment')) return 'Debt'
  if (raw.includes('transfer') || raw.includes('remittance') || raw.includes('send')) return 'Remittance'
  return 'Other'
}

export function isIncomeKind(kind: SmsExpenseKind): boolean {
  return ['income', 'refund', 'instant_transfer_in'].includes(kind ?? '')
}

export interface SmsRowData {
  userId: string
  amount: number
  currency: string
  day: string            // YYYY-MM-DD
  kind: SmsExpenseKind
  cleanTitle: string | null
  merchantNormalized: string | null
  merchant: string | null
  bankName: string | null
  categoryHint: string | null
  rawSmsSummary: string | null
  source: string
  rawBody: string
}

export interface CreateSmsExpenseResult {
  expenseId: string | null
  incomeId: string | null
}

export async function createSmsExpense(
  service: SupabaseClient,
  row: SmsRowData,
): Promise<CreateSmsExpenseResult> {
  const bankPrefix = row.bankName ? `${row.bankName}: ` : ''
  // Clean one-sentence AI summary when available; raw SMS only as fallback.
  const autoNotes = row.rawSmsSummary
    ?? `[auto from ${row.source}] ${bankPrefix}${row.rawBody.slice(0, 180)}`

  const title = row.cleanTitle ?? row.merchantNormalized ?? row.merchant ?? row.bankName

  if (isIncomeKind(row.kind)) {
    const sourceType = row.kind === 'refund' ? 'refund' : 'other'
    const { data } = await service
      .from('income_sources')
      .insert({
        user_id: row.userId,
        name: title ?? 'Bank credit',
        amount: row.amount,
        currency: row.currency,
        is_recurring: false,
        source_type: sourceType,
        notes: autoNotes,
      })
      .select('id')
      .single()
    return { expenseId: null, incomeId: data?.id ?? null }
  }

  const { data: pmRow } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', row.userId)
    .eq('is_default', true)
    .maybeSingle()

  const mappedCategory = mapKindToCategory(row.kind, row.categoryHint)

  const { data } = await service
    .from('expenses')
    .insert({
      user_id: row.userId,
      expense_date: row.day,
      description: title ?? 'Bank transaction',
      category: mappedCategory,
      amount: row.amount,
      currency: row.currency,
      payment_method_id: pmRow?.id ?? null,
      notes: autoNotes,
    })
    .select('id')
    .single()
  return { expenseId: data?.id ?? null, incomeId: null }
}
