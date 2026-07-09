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
  | 'income' | 'refund' | 'declined' | 'fee' | 'other'
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
  /** Set when this expense is linked to a tracked subscription. */
  linkedSubscriptionId?: string | null
  /** Recurring income template this credit fulfills (salary match) → links the event. */
  templateId?: string | null
  /** Force a specific category (overrides kind/hint mapping). */
  categoryOverride?: ExpenseCategory | null
  /** When set, stamp the new expense as already reversed (standalone-declined case). */
  refundMark?: { refundKind: 'refunded' | 'declined'; day: string } | null
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

function smsTitle(row: SmsRowData): string | null {
  return row.cleanTitle ?? row.merchantNormalized ?? row.merchant ?? row.bankName
}

/**
 * Resolves the user's payment method from a card/account last4, falling back to
 * the default payment method. Returns the id or null.
 */
export async function resolvePaymentMethodByLast4(
  service: SupabaseClient,
  userId: string,
  last4: string | null | undefined,
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
    if (byLast4?.id) return byLast4.id
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
  const title = smsTitle(row)

  if (isIncomeKind(row.kind)) {
    // A salary match links the event to its recurring template (source_type 'salary');
    // otherwise it's a standalone credit in the events ledger.
    const linked = !!row.templateId
    const sourceType = linked ? 'salary' : row.kind === 'refund' ? 'refund' : 'other'
    const { data, error } = await service
      .from('income_events')
      .insert({
        user_id: row.userId,
        template_id: row.templateId ?? null,
        name: title ?? (linked ? 'Salary' : 'Bank credit'),
        amount: row.amount,
        currency: row.currency,
        source_type: sourceType,
        received_date: row.day || new Date().toISOString().slice(0, 10),
        status: 'confirmed',
        sms_log_id: row.logId ?? null,
        notes: null,
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
      : await resolvePaymentMethodByLast4(service, row.userId, row.last4)
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
      notes: null,
      linked_subscription_id: row.linkedSubscriptionId ?? null,
      sms_log_id: row.logId ?? null,
      refunded_at: row.refundMark ? row.refundMark.day : null,
      refund_kind: row.refundMark?.refundKind ?? null,
      refund_sms_log_id: row.refundMark ? row.logId ?? null : null,
    })
    .select('id')
    .single()
  return { ...emptyResult(), expenseId: data?.id ?? null, error }
}

/**
 * Resolves a card last4 to a SPECIFIC payment method (no default fallback) —
 * an over-broad default would let unrelated same-amount charges match.
 */
async function resolveExactPaymentMethod(
  service: SupabaseClient,
  userId: string,
  last4: string | null | undefined,
): Promise<string | null> {
  if (!last4) return null
  const { data } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('last4', last4)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/** ± window (days) for treating a second refund SMS as a duplicate of the same event. */
const REFUND_DEDUPE_DAYS = 3

/**
 * Duplicate guard: a bank may send the same refund as two differently-worded
 * SMS (distinct sms_hash, so the route dedupe misses them). If an expense with
 * the SAME amount + currency + card was ALREADY reversed within ±3 days, the new
 * SMS is that same refund — return the twin so it acks without reversing a second
 * unrelated charge (or creating a duplicate standalone-declined row).
 */
export async function findRefundedTwin(
  service: SupabaseClient,
  row: SmsRowData,
): Promise<{ id: string; category: string } | null> {
  const lo = new Date(row.day)
  lo.setDate(lo.getDate() - REFUND_DEDUPE_DAYS)
  const hi = new Date(row.day)
  hi.setDate(hi.getDate() + REFUND_DEDUPE_DAYS + 1) // +1 so the far end includes its whole day
  const pmId = await resolveExactPaymentMethod(service, row.userId, row.last4)

  let q = service
    .from('expenses')
    .select('id, category')
    .eq('user_id', row.userId)
    .eq('currency', row.currency)
    .eq('amount', row.amount)
    .not('refunded_at', 'is', null)
    .is('deleted_at', null)
    .gte('refunded_at', lo.toISOString().slice(0, 10))
    .lte('refunded_at', hi.toISOString().slice(0, 10))
    .order('refunded_at', { ascending: false })
    .limit(1)
  if (pmId) q = q.eq('payment_method_id', pmId)

  const { data } = await q
  const best = data?.[0]
  return best ? { id: best.id, category: best.category as string } : null
}

/**
 * Finds the original expense a refund/decline SMS reverses. Requires an EXACT
 * amount + currency match on an un-refunded row within a 90-day back-window;
 * when the SMS carries a card last4 that resolves to a specific payment method,
 * that must match too. Ties break toward a description matching the counterparty,
 * then the most recent charge. Returns null when nothing qualifies (→ fallback).
 */
export async function matchOriginalExpense(
  service: SupabaseClient,
  row: SmsRowData,
): Promise<{ id: string; category: string } | null> {
  const from = new Date(row.day)
  from.setDate(from.getDate() - 90)
  const fromDay = from.toISOString().slice(0, 10)

  const pmId = await resolveExactPaymentMethod(service, row.userId, row.last4)

  let q = service
    .from('expenses')
    .select('id, category, description')
    .eq('user_id', row.userId)
    .eq('currency', row.currency)
    .eq('amount', row.amount)
    .is('refunded_at', null)
    .is('deleted_at', null)
    .gte('expense_date', fromDay)
    .lte('expense_date', row.day)
    .order('expense_date', { ascending: false })
  if (pmId) q = q.eq('payment_method_id', pmId)

  const { data } = await q
  if (!data || data.length === 0) return null

  // Rows arrive most-recent-first; a stable sort floats a counterparty-name
  // match to the top without disturbing the recency order among equals.
  const counterparty = (row.merchant ?? row.merchantNormalized ?? '').toLowerCase()
  const best = counterparty
    ? (data.find((e) => (e.description ?? '').toLowerCase().includes(counterparty)) ?? data[0])
    : data[0]
  return { id: best.id, category: best.category as string }
}

/** Stamps an existing expense as reversed. The updated_at trigger propagates it to clients. */
export async function markExpenseRefunded(
  service: SupabaseClient,
  expenseId: string,
  refundKind: 'refunded' | 'declined',
  day: string,
  logId: string | null | undefined,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await service
    .from('expenses')
    .update({ refunded_at: day, refund_kind: refundKind, refund_sms_log_id: logId ?? null })
    .eq('id', expenseId)
  return { error }
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
      notes: null,
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
      notes: null,
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
