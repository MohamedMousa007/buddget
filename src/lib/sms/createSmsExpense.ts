/**
 * Shared helper: promote a sms_parse_log row to an expense or income_source.
 * Used by both /api/sms/parse (auto-add) and /api/sms/confirm (user confirm).
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { ExpenseCategory } from '@/lib/store/types'

export type SmsExpenseKind =
  | 'purchase' | 'online_purchase' | 'atm_withdrawal'
  | 'instant_transfer_out' | 'instant_transfer_in'
  | 'cc_payoff' | 'own_transfer' | 'currency_exchange'
  | 'income' | 'refund' | 'fee' | 'other'
  | null

export function mapKindToCategory(
  kind: SmsExpenseKind,
  categoryHint: string | null,
): ExpenseCategory {
  // Money-movement kinds map to fixed non-spend categories (see categoryMeta).
  if (kind === 'atm_withdrawal') return 'ATM Cash Withdrawal'
  if (kind === 'cc_payoff') return 'CC Payoff'
  if (kind === 'own_transfer') return 'Transfer'
  if (kind === 'currency_exchange') return 'Currency Exchange'
  if (kind === 'instant_transfer_out') return 'Remittance' // external person — still spend
  const raw = (categoryHint ?? '').toLowerCase()
  if (raw.includes('rent') || raw.includes('housing')) return 'Rent'
  if (raw.includes('utilit') || raw.includes('electric') || raw.includes('water bill') || raw.includes('internet') || raw.includes('telecom') || raw.includes('mobile bill')) return 'Utilities'
  if (raw.includes('fuel') || raw.includes('petrol') || raw.includes('gas station') || raw.includes('benzine')) return 'Fuel'
  if (raw.includes('transport') || raw.includes('travel') || raw.includes('uber') || raw.includes('careem') || raw.includes('taxi')) return 'Transport'
  if (raw.includes('grocery') || raw.includes('groceries') || raw.includes('supermarket') || raw.includes('hypermarket')) return 'Groceries'
  if (raw.includes('food') || raw.includes('restaurant') || raw.includes('dining') || raw.includes('cafe') || raw.includes('coffee')) return 'Food'
  if (raw.includes('pharmac') || raw.includes('clinic') || raw.includes('hospital') || raw.includes('health') || raw.includes('medical') || raw.includes('doctor')) return 'Health'
  if (raw.includes('school') || raw.includes('universit') || raw.includes('tuition') || raw.includes('course') || raw.includes('education') || raw.includes('udemy')) return 'Education'
  if (raw.includes('subscription') || raw.includes('netflix') || raw.includes('spotify') || raw.includes('streaming')) return 'Subscription'
  if (raw.includes('shopping') || raw.includes('clothing') || raw.includes('fashion') || raw.includes('noon') || raw.includes('amazon') || raw.includes('zara')) return 'Shopping'
  if (raw.includes('entertainment') || raw.includes('enjoyment') || raw.includes('leisure') || raw.includes('cinema')) return 'Enjoyment'
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
  // --- Optional enrichment (set by the parse route) -----------------------
  /** Source account/card last4 from the SMS — used to resolve the payment method. */
  last4?: string | null
  /** Destination/counterparty account last4 (transfers/FX) for own-account matching. */
  counterpartyLast4?: string | null
  /** Transfer/FX pairing key — the SMS receive time (ISO). */
  receivedAtIso?: string | null
  /** sms_parse_log row id, stamped onto the expense for traceability/idempotency. */
  logId?: string | null
  /** Post-transaction balance to persist onto the resolved payment method. */
  newBalance?: number | null
  /** Set when this expense is linked to a tracked subscription. */
  linkedSubscriptionId?: string | null
  /** Force a specific category (overrides kind/hint mapping). */
  categoryOverride?: ExpenseCategory | null
}

export interface CreateSmsExpenseResult {
  expenseId: string | null
  incomeId: string | null
  debtPaymentId: string | null
  savingsTransactionId: string | null
  /** Non-null when the insert failed — callers must treat the row as not added. */
  error: PostgrestError | null
}

function emptyResult(): CreateSmsExpenseResult {
  return { expenseId: null, incomeId: null, debtPaymentId: null, savingsTransactionId: null, error: null }
}

function smsNotes(row: SmsRowData): string {
  const bankPrefix = row.bankName ? `${row.bankName}: ` : ''
  return row.rawSmsSummary ?? `[auto from ${row.source}] ${bankPrefix}${row.rawBody.slice(0, 180)}`
}

function smsTitle(row: SmsRowData): string | null {
  return row.cleanTitle ?? row.merchantNormalized ?? row.merchant ?? row.bankName
}

/**
 * Resolves the user's payment method from a card/account last4, falling back to
 * the default payment method. Returns the id or null. When a last4 matches, the
 * post-transaction balance (if provided) is persisted to that method.
 */
export async function resolvePaymentMethodByLast4(
  service: SupabaseClient,
  userId: string,
  last4: string | null | undefined,
  newBalance?: number | null,
): Promise<string | null> {
  if (last4) {
    const { data: byLast4 } = await service
      .from('payment_methods')
      .select('id')
      .eq('user_id', userId)
      .eq('last4', last4)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (byLast4?.id) {
      if (typeof newBalance === 'number') {
        await service.from('payment_methods').update({ balance: newBalance }).eq('id', byLast4.id)
      }
      return byLast4.id
    }
  }
  const { data: def } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle()
  return def?.id ?? null
}

export async function createSmsExpense(
  service: SupabaseClient,
  row: SmsRowData,
): Promise<CreateSmsExpenseResult> {
  const autoNotes = smsNotes(row)
  const title = smsTitle(row)

  if (isIncomeKind(row.kind)) {
    const sourceType = row.kind === 'refund' ? 'refund' : 'other'
    const { data, error } = await service
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
    return { ...emptyResult(), incomeId: data?.id ?? null, error }
  }

  // CC payoff is funded from bank/cash — never attach to a payment method, or
  // computeCreditCardOutstanding would re-add it and cancel the payoff.
  const paymentMethodId =
    row.kind === 'cc_payoff'
      ? null
      : await resolvePaymentMethodByLast4(service, row.userId, row.last4, row.newBalance)
  const mappedCategory = row.categoryOverride ?? mapKindToCategory(row.kind, row.categoryHint)

  const { data, error } = await service
    .from('expenses')
    .insert({
      user_id: row.userId,
      expense_date: row.day,
      description: title ?? 'Bank transaction',
      category: mappedCategory,
      amount: row.amount,
      currency: row.currency,
      payment_method_id: paymentMethodId,
      notes: autoNotes,
      linked_subscription_id: row.linkedSubscriptionId ?? null,
      sms_log_id: row.logId ?? null,
    })
    .select('id')
    .single()
  return { ...emptyResult(), expenseId: data?.id ?? null, error }
}

/**
 * CC payoff → records a debt payment against the user's credit-card debt and a
 * non-spend "CC Payoff" expense linked to it. The expense is funded from the
 * bank/cash source (payment_method_id = null) — NEVER the card itself, or
 * `computeCreditCardOutstanding` would re-add it and cancel the payoff.
 *
 * Resolution: match the card debt by linked payment method last4; else, if
 * exactly one active credit-card debt exists, use it. When ambiguous (multiple
 * cards, no last4 match) returns `needsConfirm: true` and posts nothing.
 */
export async function createSmsDebtPayment(
  service: SupabaseClient,
  row: SmsRowData,
): Promise<CreateSmsExpenseResult & { needsConfirm?: boolean }> {
  // Active credit-card debts for this user.
  const { data: ccDebts } = await service
    .from('debts')
    .select('id, currency, starting_balance, linked_payment_method_id')
    .eq('user_id', row.userId)
    .eq('debt_type', 'credit_card')
    .eq('status', 'active')
    .is('deleted_at', null)

  const debts = ccDebts ?? []
  let debt = debts[0]
  if (row.last4 && debts.length > 0) {
    const { data: pm } = await service
      .from('payment_methods')
      .select('id')
      .eq('user_id', row.userId)
      .eq('last4', row.last4)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    const matched = pm?.id ? debts.find((d) => d.linked_payment_method_id === pm.id) : undefined
    if (matched) debt = matched
    else if (debts.length > 1) return { ...emptyResult(), needsConfirm: true }
  } else if (debts.length > 1) {
    return { ...emptyResult(), needsConfirm: true }
  }

  if (!debt) return { ...emptyResult(), needsConfirm: true }

  // Record payment in the debt's own currency to keep balance arithmetic correct.
  const { data: payRow, error: payErr } = await service
    .from('debt_payments')
    .insert({
      user_id: row.userId,
      debt_id: debt.id,
      amount: row.amount,
      currency: (debt.currency as string) ?? row.currency,
      payment_date: row.day,
      payment_method_id: null,
      notes: smsNotes(row),
    })
    .select('id')
    .single()
  if (payErr || !payRow) return { ...emptyResult(), error: payErr }

  // Non-spend CC Payoff expense, funded from bank/cash (never the card).
  const { data: expRow, error: expErr } = await service
    .from('expenses')
    .insert({
      user_id: row.userId,
      expense_date: row.day,
      description: smsTitle(row) ?? 'Credit Card Payment',
      category: 'CC Payoff',
      amount: row.amount,
      currency: row.currency,
      payment_method_id: null,
      is_debt_payment: true,
      linked_debt_payment_id: payRow.id,
      notes: smsNotes(row),
      sms_log_id: row.logId ?? null,
    })
    .select('id')
    .single()

  return {
    ...emptyResult(),
    expenseId: expRow?.id ?? null,
    debtPaymentId: payRow.id,
    error: expErr,
  }
}
