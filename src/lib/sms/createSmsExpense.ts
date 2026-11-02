/**
 * Shared helper: promote a sms_parse_log row to an expense or income_source.
 * Used by both /api/sms/parse (auto-add) and /api/sms/confirm (user confirm).
 */
import type { ServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/database.types'
import type {PostgrestError} from '@supabase/supabase-js'
import { localTodayISO } from '@/lib/utils/localDate'
import type { ExpenseCategory } from '@/lib/store/types'
import {
  PAYMENT_BRANDS,
  decomposePaymentMethodName,
  resolvePaymentBrandKey,
} from '@/lib/payment/paymentMethodDefaults'
import { matchByTail } from '@/lib/accounts/identity/accountRef'
import { toSupportedCurrency } from './ingestGuards'
import { normalizeMerchant } from './merchantNormalizer'
import { resolveMerchantCategory, rememberMerchantCategory } from './merchantCategoryCache'

export type SmsExpenseKind =
  | 'purchase' | 'online_purchase' | 'atm_withdrawal'
  | 'instant_transfer_out' | 'instant_transfer_in'
  | 'cc_payoff' | 'installment_payment' | 'own_transfer' | 'currency_exchange'
  | 'income' | 'refund' | 'declined' | 'fee' | 'other'
  | null

/**
 * Narrows a validated currency string to the DB enum at the persistence boundary.
 *
 * `SmsRowData.currency` is a plain string because it arrives from the parser tiers. Anything outside
 * the enum would fail the insert (and loop `/confirm` on 500), so it falls back to EGP, the same
 * default `resolveCurrency` ends in.
 */
function dbCurrency(c: string): Database['public']['Enums']['currency_code'] {
  return toSupportedCurrency(c) ?? 'EGP'
}

/**
 * Egyptian InstaPay (IPN) markers — English "IPN", Arabic "تحويل لحظي" (instant transfer), or
 * the brand name. By the time a row is categorised its kind is settled: own-account IPN has
 * already been reclassified to `own_transfer`, so an `instant_transfer_out` carrying these
 * markers is a genuine send over InstaPay.
 */
const EGYPTIAN_IPN = /\bIPN\b|تحويل\s+لحظ[يى]|instapay/i

export function isEgyptianInstapay(rawBody: string | null | undefined): boolean {
  return !!rawBody && EGYPTIAN_IPN.test(rawBody)
}

export function mapKindToCategory(
  kind: SmsExpenseKind,
  categoryHint: string | null,
  rawBody?: string | null,
): ExpenseCategory {
  // Money-movement kinds map to fixed non-spend categories (see categoryMeta).
  if (kind === 'atm_withdrawal') return 'ATM Cash Withdrawal'
  if (kind === 'cc_payoff') return 'CC Payoff'
  if (kind === 'installment_payment') return 'Installment'
  if (kind === 'own_transfer') return 'Transfer'
  if (kind === 'currency_exchange') return 'Currency Exchange'
  if (kind === 'instant_transfer_out') {
    // An external send — still spend. In Egypt it almost always rides InstaPay (IPN); label it
    // as such so it's instantly recognisable. Non-IPN / international sends stay 'Remittance'.
    return isEgyptianInstapay(rawBody) ? 'Instapay' : 'Remittance'
  }
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
  /**
   * SMS sender ID ("barq app", "AlRajhiBank"). Identifies the PROVIDER when no registered
   * last4 does — the only way to attribute a wallet whose cards the user never registered.
   * Always empty on iOS (Shortcuts never exposes the sender); the parse route names the provider from the body instead.
   */
  sender?: string | null
  // --- Optional enrichment (set by the parse route) -----------------------
  /** Source account/card last4 from the SMS — used to resolve the payment method. */
  last4?: string | null
  /** Destination/counterparty account last4 (transfers/FX) for own-account matching. */
  counterpartyLast4?: string | null
  /** Transfer/FX pairing key — the SMS receive time (ISO). */
  receivedAtIso?: string | null
  /** sms_parse_log row id, stamped onto the expense for traceability/idempotency. */
  logId?: string | null
  /**
   * The DB template whose regex produced this row, when one did. Carried so a downstream
   * correction (e.g. the direction guard overriding the parsed kind) can be attributed back to
   * the template that got it wrong.
   */
  matchedTemplateId?: string | null
  /** Set when this expense is linked to a tracked subscription. */
  linkedSubscriptionId?: string | null
  /** Recurring income template this credit fulfills (salary match) → links the event. */
  templateId?: string | null
  /**
   * `YYYY-MM-DD` scheduled payday this credit fulfills. Load-bearing: `buildOccurrences`
   * pairs on this column and falls back to POSITIONAL pairing without it, so an unstamped
   * late paycheck fills the wrong month's payday. Only meaningful alongside `templateId`.
   */
  occurrenceDate?: string | null
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

const UNIQUE_VIOLATION = '23505'

/** A retry of the same SMS hits the unique sms_log_id index: the row already exists, so that is success, not failure. */
async function existingExpenseForLog(service: ServiceClient, userId: string, logId: string) {
  const { data } = await service
    .from('expenses')
    .select('id, linked_debt_payment_id')
    .eq('user_id', userId)
    .eq('sms_log_id', logId)
    .neq('description', 'Transfer fee')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  return data ?? null
}

type DebtPaymentArgs = {
  debtId: string
  debtCurrency: string | null
  isGold: boolean
  fundingPaymentMethodId: string | null
  description: string
  category: ExpenseCategory
}

/**
 * The SMS amount is money in the SMS currency; a debt payment stores it in DEBT units. Only a same-currency,
 * non-gold debt can be settled without a rate, so anything else is left to the user (never mislabel units).
 */
function debtUnits(row: SmsRowData, a: DebtPaymentArgs) {
  if (a.isGold || (a.debtCurrency && a.debtCurrency !== row.currency)) return null
  return { amountInDebtUnit: row.amount, originalAmount: row.amount, originalCurrency: dbCurrency(row.currency) }
}

type RpcCaller = (fn: string, args: Record<string, unknown>) => Promise<{
  data: { outcome?: string; debt_payment_id?: string; expense_id?: string } | null
  error: PostgrestError | null
}>

function isMissingRpc(e: PostgrestError): boolean {
  return e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? '')
}

/**
 * Debt payment + its expense as one idempotent unit (migration 0210 RPC, keyed on sms_log_id). Falls back to the
 * legacy two-insert path while the RPC is not deployed yet (PGRST202); the legacy path still reuses an expense a
 * previous attempt already booked for this SMS, so a retry cannot reduce the debt twice.
 */
async function postSmsDebtPayment(
  service: ServiceClient,
  row: SmsRowData,
  a: DebtPaymentArgs,
): Promise<CreateSmsExpenseResult & { needsConfirm?: boolean }> {
  const units = debtUnits(row, a)
  if (!units) return { ...emptyResult(), needsConfirm: true }
  const debtCurrency = dbCurrency(a.debtCurrency ?? row.currency)
  const payment = {
    debt_id: a.debtId,
    payment_method_id: a.fundingPaymentMethodId,
    amount: row.amount,
    currency: debtCurrency,
    payment_date: row.day,
    occurred_at: row.receivedAtIso ?? null,
    amount_in_debt_unit: units.amountInDebtUnit,
    original_amount: units.originalAmount,
    original_currency: units.originalCurrency,
  }

  if (row.logId) {
    const { data, error } = await (service as unknown as { rpc: RpcCaller }).rpc('add_sms_debt_payment_with_expense', {
      p_user_id: row.userId,
      p_sms_log_id: row.logId,
      p_payment: payment,
      p_expense: {
        description: a.description,
        category: a.category,
        amount: row.amount,
        currency: dbCurrency(row.currency),
        expense_date: row.day,
        occurred_at: row.receivedAtIso ?? null,
        payment_method_id: a.fundingPaymentMethodId,
      },
    })
    if (!error) {
      if (data?.outcome === 'overpay') return { ...emptyResult(), needsConfirm: true }
      return { ...emptyResult(), expenseId: data?.expense_id ?? null, debtPaymentId: data?.debt_payment_id ?? null }
    }
    if (!isMissingRpc(error)) return { ...emptyResult(), error }

    const prior = await existingExpenseForLog(service, row.userId, row.logId)
    if (prior) return { ...emptyResult(), expenseId: prior.id, debtPaymentId: prior.linked_debt_payment_id ?? null }
  }

  const { data: payRow, error: payErr } = await service
    .from('debt_payments')
    .insert({
      user_id: row.userId,
      debt_id: a.debtId,
      amount: row.amount,
      currency: debtCurrency,
      payment_date: row.day,
      payment_method_id: a.fundingPaymentMethodId,
      amount_in_debt_unit: units.amountInDebtUnit,
      original_amount: units.originalAmount,
      original_currency: units.originalCurrency,
      notes: null,
    })
    .select('id')
    .single()
  if (payErr || !payRow) return { ...emptyResult(), error: payErr }

  const { data: expRow, error: expErr } = await service
    .from('expenses')
    .insert({
      user_id: row.userId,
      expense_date: row.day,
      description: a.description,
      category: a.category,
      amount: row.amount,
      currency: dbCurrency(row.currency),
      payment_method_id: a.fundingPaymentMethodId,
      is_debt_payment: true,
      linked_debt_id: a.debtId,
      linked_debt_payment_id: payRow.id,
      notes: null,
      sms_log_id: row.logId ?? null,
    })
    .select('id')
    .single()
  return { ...emptyResult(), expenseId: expRow?.id ?? null, debtPaymentId: payRow.id, error: expErr }
}

/**
 * The single chokepoint for what a transaction is called. Every parse tier (curated,
 * learned template, AI) and the user-confirm path reach the DB through here, which is why
 * normalisation belongs at this line rather than in any one tier's title builder.
 */
function smsTitle(row: SmsRowData): string | null {
  const raw = row.cleanTitle ?? row.merchantNormalized ?? row.merchant
  return normalizeMerchant(raw, row.kind) ?? row.bankName
}

/**
 * Resolves the payment method from WHO SENT the SMS — "barq app" → the user's Barq wallet.
 *
 * A wallet is a single balance, but its messages name whichever card was used, and a wallet
 * hands out several: Barq prints its physical mada card on a POS purchase and a virtual card
 * on an online one. Registering every card would be endless bookkeeping and the numbers
 * change. The sender identifies the wallet ITSELF, so "Barq" is registered once and every
 * Barq message — top-up, POS, virtual card — attributes to it, last4 or not.
 *
 * Gated to brands that only hold money:
 *  - banks are excluded by the wallet check: a bank sender names the institution, not which
 *    of its many cards was used.
 *  - pass-through rails hold no balance to attribute to.
 *  - a brand you can also BUY from would mis-attribute: "Vodafone" sends telecom bills as
 *    well as Vodafone Cash notices, and a bill is paid from a card, not from the wallet.
 */
async function resolvePaymentMethodByProvider(
  service: ServiceClient,
  userId: string,
  ...tokens: (string | null | undefined)[]
): Promise<string | null> {
  for (const token of tokens) {
    const brandId = resolvePaymentBrandKey(token)
    if (!brandId) continue
    const brand = PAYMENT_BRANDS[brandId]
    if (brand.type !== 'wallet' || brand.passThrough || brand.alsoMerchant) continue
    const { data } = await service
      .from('payment_methods')
      .select('id, name, last4')
      .eq('user_id', userId)
      .eq('type', 'wallet')
      .is('deleted_at', null)
    const hit = (data ?? []).find((m) => {
      const provider = decomposePaymentMethodName(
        ((m.name as string | null) ?? '').trim(),
        (m.last4 as string | null) ?? undefined,
      ).provider
      return resolvePaymentBrandKey(provider) === brandId
    })
    if (hit?.id) return hit.id as string
  }
  return null
}

/** PostgREST code for "more than one row" on a single-row request. */
const MULTIPLE_ROWS = 'PGRST116'

/**
 * The one registered method this tail names. An exact saved match wins. Otherwise the tail may be a shorter or longer
 * form of a saved one ("***-001" names the account saved as 0001) and exactly one method must fit. Two or more fitting
 * is ambiguous: neither is picked, because attributing money to the wrong account is worse than asking.
 */
async function findUniqueByLast4(
  service: ServiceClient,
  userId: string,
  last4: string,
): Promise<{ id: string | null; ambiguous: boolean }> {
  const { data, error } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('last4', last4)
    .is('deleted_at', null)
    .maybeSingle()
  if (error?.code === MULTIPLE_ROWS) return { id: null, ambiguous: true }
  if (data?.id) return { id: data.id, ambiguous: false }

  const { data: all, error: listError } = await service
    .from('payment_methods')
    .select('id, last4')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (listError) {
    console.warn('[sms/account] method lookup failed', listError.message)
    return { id: null, ambiguous: false }
  }
  return matchByTail((all ?? []) as { id: string; last4: string | null }[], last4)
}

/**
 * Resolves the user's payment method for an SMS, most specific signal first:
 *   1. the account/card last4 the SMS names — exact, when the user registered that card
 *   2. the provider that sent it — see {@link resolvePaymentMethodByProvider}
 *   3. the default method
 *
 * `sender` before `bankName` mirrors pickProvider: many banks omit their own name from the
 * body, so the sender ID is often the only institution signal.
 */
export async function resolvePaymentMethodByLast4(
  service: ServiceClient,
  userId: string,
  last4: string | null | undefined,
  provider?: { sender?: string | null; bankName?: string | null },
): Promise<string | null> {
  if (last4) {
    const byLast4 = await findUniqueByLast4(service, userId, last4)
    if (byLast4.ambiguous) return null
    if (byLast4.id) return byLast4.id
  }
  const byProvider = await resolvePaymentMethodByProvider(
    service,
    userId,
    provider?.sender,
    provider?.bankName,
  )
  if (byProvider) return byProvider
  const { data: def } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle()
  return def?.id ?? null
}

/** Where a credit lands: the exact account/card the message names, else the sending provider. Never the default method. */
async function resolveCreditAccount(service: ServiceClient, row: SmsRowData): Promise<string | null> {
  return (await resolveExactPaymentMethod(service, row.userId, row.last4))
    ?? (await resolvePaymentMethodByProvider(service, row.userId, row.sender, row.bankName))
}

/** The user's Cash account (oldest cash method): the target of an ATM withdrawal. */
async function cashAccountFor(service: ServiceClient, userId: string): Promise<string | null> {
  const { data } = await service.from('payment_methods').select('id')
    .eq('user_id', userId).eq('type', 'cash').is('deleted_at', null).is('closed_at', null)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  return data?.id ?? null
}

export async function createSmsExpense(
  service: ServiceClient,
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
        currency: dbCurrency(row.currency),
        source_type: sourceType,
        received_date: row.day || localTodayISO(),
        // The payday fulfilled, when the matcher could name one. Never set without a
        // template — an unlinked credit belongs to no schedule.
        occurrence_date: linked ? row.occurrenceDate ?? null : null,
        status: 'confirmed',
        sms_log_id: row.logId ?? null,
        payment_method_id: await resolveCreditAccount(service, row),
        occurred_at: row.receivedAtIso ?? null,
        notes: null,
      })
      .select('id')
      .single()
    if (error?.code === UNIQUE_VIOLATION && row.logId) {
      const { data: prior } = await service
        .from('income_events')
        .select('id')
        .eq('user_id', row.userId)
        .eq('sms_log_id', row.logId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
      if (prior) return { ...emptyResult(), incomeId: prior.id }
    }
    return { ...emptyResult(), incomeId: data?.id ?? null, error }
  }

  // CC payoff is funded from bank/cash — never attach to a payment method, or
  // computeCreditCardOutstanding would re-add it and cancel the payoff.
  const paymentMethodId =
    row.kind === 'cc_payoff'
      ? null
      : await resolvePaymentMethodByLast4(service, row.userId, row.last4, {
          sender: row.sender,
          bankName: row.bankName,
        })
  let mappedCategory = row.categoryOverride ?? mapKindToCategory(row.kind, row.categoryHint, row.rawBody)
  // Purchases are the only merchant-bearing spend kind, and curated/template tiers hand them
  // over with no categoryHint → they default to 'Other'. Fill from the shared merchant memory
  // (catalog + learned cache); when the AI DID name a category, feed it back so the next
  // curated/template hit on this merchant is categorised for free. Keyed on `title`, the same
  // string the stored description (and the user-edit trigger) uses.
  if (row.kind === 'purchase' || row.kind === 'online_purchase') {
    if (mappedCategory === 'Other') {
      const learned = await resolveMerchantCategory(service, title, row.userId)
      if (learned) mappedCategory = learned
    } else if (row.categoryHint) {
      await rememberMerchantCategory(service, title, mappedCategory, 'ai')
    }
  }

  // Money that stays inside the user's own accounts credits the other side: cash out lands in Cash,
  // an own transfer lands in the account named as counterparty (the posted row is always the debit leg).
  const toPaymentMethodId =
    row.kind === 'atm_withdrawal' ? await cashAccountFor(service, row.userId)
    : row.kind === 'own_transfer' ? await resolveExactPaymentMethod(service, row.userId, row.counterpartyLast4)
    : null

  const { data, error } = await service
    .from('expenses')
    .insert({
      user_id: row.userId,
      expense_date: row.day,
      occurred_at: row.receivedAtIso ?? null,
      to_payment_method_id: toPaymentMethodId,
      description: title ?? 'Bank transaction',
      category: mappedCategory,
      amount: row.amount,
      currency: dbCurrency(row.currency),
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
  if (error?.code === UNIQUE_VIOLATION && row.logId) {
    const prior = await existingExpenseForLog(service, row.userId, row.logId)
    if (prior) return { ...emptyResult(), expenseId: prior.id }
  }
  return { ...emptyResult(), expenseId: data?.id ?? null, error }
}

/** ± fraction the SMS amount may differ from a plan's installment amount and still match. */
const INSTALLMENT_AMOUNT_TOLERANCE = 0.02

/**
 * Installment payment → records a debt payment against a matching installment plan
 * and a settlement expense (non-spend `Installment` for BNPL, `Debt` spend otherwise —
 * mirroring the manual/recurring settlement split so net worth moves exactly once).
 *
 * Resolution, most specific first:
 *   1. a plan whose provider brand the SMS names AND whose installment amount matches
 *   2. exactly one active installment plan → use it
 *   3. otherwise ambiguous → `needsConfirm: true`, posts nothing (surfaced to review UI /
 *      the in-view assign banner). Deliberately conservative: never auto-assign on a
 *      guess, so a stray provider SMS can't silently reduce the wrong plan.
 */
export async function createSmsInstallmentPayment(
  service: ServiceClient,
  row: SmsRowData,
): Promise<CreateSmsExpenseResult & { needsConfirm?: boolean }> {
  const { data: plans } = await service
    .from('debts')
    .select('id, currency, is_gold, installment_amount, installment_provider_name, linked_payment_method_id')
    .eq('user_id', row.userId)
    .eq('debt_type', 'installment')
    .eq('status', 'active')
    .is('deleted_at', null)

  const list = plans ?? []
  if (list.length === 0) return { ...emptyResult(), needsConfirm: true }

  const amountMatches = (planAmount: number | null) =>
    planAmount != null && planAmount > 0 &&
    Math.abs(planAmount - row.amount) <= planAmount * INSTALLMENT_AMOUNT_TOLERANCE

  // Provider brand as named anywhere in the SMS (sender > bank > body).
  const haystack = `${row.sender ?? ''} ${row.bankName ?? ''} ${row.merchant ?? ''} ${row.rawBody ?? ''}`.toLowerCase()
  const byProvider = list.filter((p) => {
    const brand = ((p.installment_provider_name as string | null) ?? '').trim().toLowerCase()
    return brand.length >= 3 && haystack.includes(brand)
  })

  let plan: (typeof list)[number] | undefined
  const providerAndAmount = byProvider.filter((p) => amountMatches(p.installment_amount as number | null))
  if (providerAndAmount.length === 1) plan = providerAndAmount[0]
  else if (byProvider.length === 1) plan = byProvider[0]
  else if (list.length === 1) plan = list[0]

  if (!plan) return { ...emptyResult(), needsConfirm: true }

  // BNPL plan (funded from a `bnpl` method) → the purchase was booked at checkout,
  // so the settlement is non-spend `Installment`; bank/other plans keep `Debt` spend.
  let isBnpl = false
  if (plan.linked_payment_method_id) {
    const { data: pm } = await service
      .from('payment_methods')
      .select('type')
      .eq('id', plan.linked_payment_method_id as string)
      .is('deleted_at', null)
      .maybeSingle()
    isBnpl = pm?.type === 'bnpl'
  }

  // The SMS from an installment provider usually names the funding card directly.
  const fundingPaymentMethodId = await resolveExactPaymentMethod(service, row.userId, row.last4)

  return postSmsDebtPayment(service, row, {
    debtId: plan.id as string,
    debtCurrency: (plan.currency as string | null) ?? null,
    isGold: plan.is_gold === true,
    fundingPaymentMethodId,
    description: smsTitle(row) ?? 'Installment payment',
    category: isBnpl ? 'Installment' : 'Debt',
  })
}

/**
 * Resolves a card last4 to a SPECIFIC payment method (no default fallback) —
 * an over-broad default would let unrelated same-amount charges match.
 */
export async function resolveExactPaymentMethod(
  service: ServiceClient,
  userId: string,
  last4: string | null | undefined,
): Promise<string | null> {
  if (!last4) return null
  return (await findUniqueByLast4(service, userId, last4)).id
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
  service: ServiceClient,
  row: SmsRowData,
): Promise<{ id: string; category: string } | null> {
  const lo = new Date(row.day)
  lo.setUTCDate(lo.getUTCDate() - REFUND_DEDUPE_DAYS)
  const hi = new Date(row.day)
  hi.setUTCDate(hi.getUTCDate() + REFUND_DEDUPE_DAYS + 1) // +1 so the far end includes its whole day
  const pmId = await resolveExactPaymentMethod(service, row.userId, row.last4)

  let q = service
    .from('expenses')
    .select('id, category')
    .eq('user_id', row.userId)
    .eq('currency', dbCurrency(row.currency))
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
  service: ServiceClient,
  row: SmsRowData,
): Promise<{ id: string; category: string } | null> {
  const from = new Date(row.day)
  from.setUTCDate(from.getUTCDate() - 90)
  const fromDay = from.toISOString().slice(0, 10)

  const pmId = await resolveExactPaymentMethod(service, row.userId, row.last4)

  let q = service
    .from('expenses')
    .select('id, category, description')
    .eq('user_id', row.userId)
    .eq('currency', dbCurrency(row.currency))
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
  service: ServiceClient,
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
 * non-spend "CC Payoff" expense linked to it.
 *
 * The expense carries the FUNDING account (the bank the money left), not the card.
 * `fundingLast4` comes from the paired funding leg, because the card bank's SMS reports
 * the CARD's last4 — it cannot tell us where the money came from. Attaching it is safe
 * only because `computeCreditCardOutstanding` now skips non-spend rows; before that it
 * would have re-added the payoff to the balance and cancelled its own payment.
 *
 * Resolution: match the card debt by linked payment method last4; else, if
 * exactly one active credit-card debt exists, use it. When ambiguous (multiple
 * cards, no last4 match) returns `needsConfirm: true` and posts nothing.
 */
export async function createSmsDebtPayment(
  service: ServiceClient,
  row: SmsRowData,
  opts: { fundingLast4?: string | null } = {},
): Promise<CreateSmsExpenseResult & { needsConfirm?: boolean }> {
  // Active credit-card debts for this user.
  const { data: ccDebts } = await service
    .from('debts')
    .select('id, currency, is_gold, starting_balance, linked_payment_method_id')
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

  // The account the money LEFT. `resolveExactPaymentMethod` (no default fallback) is
  // deliberate: `resolvePaymentMethodByLast4` falls back to the is_default method, which
  // would silently stamp an arbitrary card as the funding source. Unknown must stay null
  // (renders as Cash) rather than becoming a confident wrong answer.
  const fundingPaymentMethodId = await resolveExactPaymentMethod(service, row.userId, opts.fundingLast4)

  return postSmsDebtPayment(service, row, {
    debtId: debt.id as string,
    debtCurrency: (debt.currency as string | null) ?? null,
    isGold: debt.is_gold === true,
    fundingPaymentMethodId,
    description: smsTitle(row) ?? 'Credit Card Payment',
    category: 'CC Payoff',
  })
}
