/**
 * Which earlier row does a refund or a decline belong to? (docs/launch/S2c-invariants.md, I1 exception 1 and I2)
 *
 * The decisions are pure functions over plain candidate data; the two `find*` functions only read candidates and
 * hand them over. A refund is matched from MESSAGES, never from the user's expenses directly, so "an earlier row
 * created by a message" and "a purchase, online purchase or transfer out" hold by construction. A decline reads
 * nothing but its own earlier declines.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import { tailsMatch } from '@/lib/accounts/identity/accountRef'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { normalizeMerchant } from './merchantNormalizer'
import { resolveExactPaymentMethod, providerOf, type SmsRowData } from './createSmsExpense'

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
const AMOUNT_EPSILON = 0.005
const REFUND_LOOKBACK_DAYS = 90
const WINDOW_MINUTES = 15
const DECLINE_TWIN_DAYS = 3
const CANDIDATE_LIMIT = 500
const CROSS_CURRENCY_TOLERANCE = 0.05

/** The kinds of earlier message a refund may reverse. Never a cash withdrawal, a fee, a repayment or an instalment. */
export const REFUNDABLE_KINDS = ['purchase', 'online_purchase', 'instant_transfer_out'] as const

const DECLINE_WORDING = /declin|reject|refus|مرفوض|رفض/i

/** Declined, rejected or refused: no money moved. "Reversed" wording is a refund and is not matched here. */
export function isDeclineMessage(kind: string | null | undefined, rawBody: string | null | undefined): boolean {
  if (kind === 'declined') return true
  return kind === 'refund' && DECLINE_WORDING.test(rawBody ?? '')
}

export interface RefundCandidate {
  id: string
  kind: string | null
  amount: number | null
  currency: string | null
  account_last4: string | null
  received_at: string
  reference_hash: string | null
  merchant_normalized: string | null
  clean_title: string | null
  expense_id: string | null
}

export interface RefundFacts {
  logId?: string | null
  amount: number
  currency: string
  last4: string | null
  receivedAtMs: number
  referenceHash: string | null
  merchant: string | null
  rates?: Record<string, number>
}

export type RefundRule = 'reference' | 'window' | 'merchant' | 'merchant_partial'

export interface RefundPick {
  candidate: RefundCandidate
  rule: RefundRule
  /** Null: the whole purchase is refunded. Otherwise the part refunded, in the candidate's currency. */
  refundedAmount: number | null
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * How much of the candidate this refund reverses: `{ refundedAmount: null }` for all of it, a number for a part, null
 * when it cannot be this candidate (larger than it, or a currency or rate that is unknown, I7). A refund in another
 * currency is converted into the candidate's and counts as the whole when within 5% of it.
 */
function refundFit(c: RefundCandidate, refund: RefundFacts): { refundedAmount: number | null } | null {
  if (c.amount == null || !c.currency || !refund.currency) return null
  const cross = c.currency.toLowerCase() !== refund.currency.toLowerCase()
  // tryConvertCurrency falls back to built-in rates, so an absent rate table has to be refused here.
  if (cross && !Object.keys(refund.rates ?? {}).length) return null
  const converted = cross ? tryConvertCurrency(refund.amount, refund.currency.toUpperCase(), c.currency.toUpperCase(), refund.rates ?? {}) : refund.amount
  if (converted == null || !Number.isFinite(converted)) return null
  if (Math.abs(converted - c.amount) < AMOUNT_EPSILON) return { refundedAmount: null }
  if (cross && Math.abs(converted - c.amount) <= c.amount * CROSS_CURRENCY_TOLERANCE) return { refundedAmount: null }
  return converted < c.amount ? { refundedAmount: round2(converted) } : null
}

function sameMerchant(refundMerchant: string | null, candidateMerchant: string | null): boolean {
  const a = normalizeMerchant(refundMerchant, 'purchase')?.trim().toLowerCase()
  const b = normalizeMerchant(candidateMerchant, 'purchase')?.trim().toLowerCase()
  return !!a && !!b && a === b
}

/**
 * Every candidate the refund may reverse, in the order to try them: first by the rule that hit (reference, then
 * window, then merchant), then within a rule by its own ordering. A candidate appears once, under its first rule.
 * An unknown value (no tail, no merchant, no reference) never counts as a match (I7).
 */
export function pickRefundOriginals(candidates: readonly RefundCandidate[], refund: RefundFacts): RefundPick[] {
  const earliest = refund.receivedAtMs - REFUND_LOOKBACK_DAYS * DAY_MS
  const latest = refund.receivedAtMs + WINDOW_MINUTES * MINUTE_MS
  const eligible = candidates
    .filter((c) => c.id !== refund.logId && !!c.expense_id && (REFUNDABLE_KINDS as readonly string[]).includes(c.kind ?? ''))
    .map((c) => ({ c, at: Date.parse(c.received_at) }))
    .filter(({ at }) => Number.isFinite(at) && at >= earliest && at <= latest)
    .sort((x, y) => y.at - x.at)

  const sameMoney = (c: RefundCandidate): boolean =>
    c.amount != null && Math.abs(c.amount - refund.amount) < AMOUNT_EPSILON && !!c.currency && c.currency.toLowerCase() === refund.currency.toLowerCase()
  const sameAccount = (c: RefundCandidate): boolean => !!refund.last4 && !!c.account_last4 && tailsMatch(refund.last4, c.account_last4)

  const picks: RefundPick[] = []
  const taken = new Set<string>()
  const add = (rule: RefundRule, list: typeof eligible, amountOf: (c: RefundCandidate) => number | null = () => null): void => {
    for (const { c } of list) {
      if (taken.has(c.id)) continue
      taken.add(c.id)
      picks.push({ candidate: c, rule, refundedAmount: amountOf(c) })
    }
  }
  const fitting = (list: typeof eligible) => list.flatMap((e) => { const fit = refundFit(e.c, refund); return fit ? [{ ...e, fit }] : [] })

  const byReference = fitting(eligible.filter(({ c }) => !!refund.referenceHash && c.reference_hash === refund.referenceHash))
  add('reference', byReference, (c) => byReference.find((x) => x.c.id === c.id)?.fit.refundedAmount ?? null)
  add(
    'window',
    eligible
      .filter(({ c, at }) => sameAccount(c) && sameMoney(c) && Math.abs(at - refund.receivedAtMs) <= WINDOW_MINUTES * MINUTE_MS)
      .sort((x, y) => Math.abs(x.at - refund.receivedAtMs) - Math.abs(y.at - refund.receivedAtMs)),
  )
  add(
    'merchant',
    eligible.filter(({ c }) => sameAccount(c) && sameMoney(c) && sameMerchant(refund.merchant, c.merchant_normalized ?? c.clean_title)),
  )
  // A part of a purchase, or a purchase in another currency: only when exactly one purchase at the merchant fits (I3, I7).
  const partial = fitting(eligible.filter(({ c }) => sameAccount(c) && sameMerchant(refund.merchant, c.merchant_normalized ?? c.clean_title)))
  if (partial.length === 1) add('merchant_partial', partial, () => partial[0].fit.refundedAmount)
  return picks
}

export interface DeclineTwinCandidate {
  id: string
  category: string
  sms_log_id: string | null
  refund_sms_log_id: string | null
  refund_kind: string | null
  refunded_at: string | null
  payment_method_id: string | null
}

/**
 * The earlier decline's own row this decline repeats, or null. Only a row a standalone decline created for itself
 * counts (`refund_sms_log_id` is its own `sms_log_id`); a purchase that something stamped never does. When this
 * message names a specific payment method, the earlier row must sit on the same one.
 */
export function pickDeclineTwin(
  candidates: readonly DeclineTwinCandidate[],
  decline: { day: string; paymentMethodId: string | null },
): DeclineTwinCandidate | null {
  const dayMs = Date.parse(decline.day)
  const own = candidates
    .filter((c) => c.refund_kind === 'declined' && !!c.sms_log_id && c.refund_sms_log_id === c.sms_log_id && !!c.refunded_at)
    .filter((c) => Math.abs(Date.parse(c.refunded_at as string) - dayMs) <= DECLINE_TWIN_DAYS * DAY_MS)
    .filter((c) => !decline.paymentMethodId || c.payment_method_id === decline.paymentMethodId)
    .sort((x, y) => (y.refunded_at as string).localeCompare(x.refunded_at as string))
  return own[0] ?? null
}

/** An earlier decline of the same amount and card this message repeats, so it is acknowledged against it. Reads only. */
export async function findDeclineTwin(service: ServiceClient, row: SmsRowData): Promise<{ id: string; category: string } | null> {
  const lo = new Date(Date.parse(row.day) - DECLINE_TWIN_DAYS * DAY_MS).toISOString().slice(0, 10)
  const hi = new Date(Date.parse(row.day) + DECLINE_TWIN_DAYS * DAY_MS).toISOString().slice(0, 10)
  const { data } = await service
    .from('expenses')
    .select('id, category, sms_log_id, refund_sms_log_id, refund_kind, refunded_at, payment_method_id')
    .eq('user_id', row.userId)
    .eq('currency', row.currency as never)
    .eq('amount', row.amount)
    .eq('refund_kind', 'declined')
    .is('deleted_at', null)
    .not('sms_log_id', 'is', null)
    .gte('refunded_at', lo)
    .lte('refunded_at', hi)
  const paymentMethodId = await resolveExactPaymentMethod(service, row.userId, row.last4, providerOf(row))
  const twin = pickDeclineTwin((data ?? []) as DeclineTwinCandidate[], { day: row.day, paymentMethodId })
  return twin ? { id: twin.id, category: twin.category } : null
}

/**
 * The earlier purchase or transfer out this refund reverses, or null. Candidates are earlier messages of this user
 * that booked a row; the picked message's expense must still be live, unrefunded, and created by that message.
 */
export async function findRefundOriginal(
  service: ServiceClient,
  row: SmsRowData,
  rates?: Record<string, number>,
): Promise<{ id: string; category: string; rule: RefundRule; refundedAmount: number | null } | null> {
  const at = row.receivedAtIso ? Date.parse(row.receivedAtIso) : Date.now()
  const receivedAtMs = Number.isFinite(at) ? at : Date.now()
  let q = service
    .from('sms_parse_log')
    .select('id, kind, amount, currency, account_last4, received_at, reference_hash, merchant_normalized, clean_title, expense_id')
    .eq('user_id', row.userId)
    .eq('is_duplicate', false)
    .not('expense_id', 'is', null)
    .in('kind', [...REFUNDABLE_KINDS])
    .gte('received_at', new Date(receivedAtMs - REFUND_LOOKBACK_DAYS * DAY_MS).toISOString())
    .lte('received_at', new Date(receivedAtMs + WINDOW_MINUTES * MINUTE_MS).toISOString())
    .order('received_at', { ascending: false })
    .limit(CANDIDATE_LIMIT)
  if (row.logId) q = q.neq('id', row.logId)
  const { data: logs } = await q

  const picks = pickRefundOriginals((logs ?? []) as RefundCandidate[], {
    logId: row.logId,
    amount: row.amount,
    currency: row.currency,
    last4: row.last4 ?? null,
    receivedAtMs,
    referenceHash: row.referenceHash ?? null,
    merchant: row.merchantNormalized ?? row.merchant,
    rates,
  })
  if (picks.length === 0) return null

  const { data: expenses } = await service
    .from('expenses')
    .select('id, category, sms_log_id, amount')
    .eq('user_id', row.userId)
    .in('id', picks.map((p) => p.candidate.expense_id as string))
    .is('deleted_at', null)
    .is('refunded_at', null)
    .is('refunded_amount', null)
    .neq('description', 'Transfer fee')
  for (const { candidate, rule, refundedAmount } of picks) {
    const e = (expenses ?? []).find((x) => x.id === candidate.expense_id && x.sms_log_id === candidate.id)
    if (e && (refundedAmount == null || e.amount > refundedAmount)) return { id: e.id, category: e.category as string, rule, refundedAmount }
  }
  return null
}

export interface EarlierUnmatchedRefund {
  expenseId: string
  refundedAt: string
  log: Pick<RefundCandidate, 'id' | 'received_at' | 'reference_hash' | 'account_last4' | 'merchant_normalized' | 'clean_title'>
}

/**
 * The earlier unmatched refund a purchase that arrived after it completes (docs/launch/S2c-invariants.md, I1 exception
 * 1 reversed in time), by the first rule that hits, nearest in time within a rule: (a) the same reference; (b) the same
 * account, messages 15 minutes apart or less; (c) the same account and merchant, the refund received no earlier than
 * the purchase (delivered out of order). Amount and currency are matched by the caller. Unknown never matches (I7).
 */
export function pickEarlierUnmatchedRefund(
  refunds: readonly EarlierUnmatchedRefund[],
  purchase: { receivedAtMs: number; referenceHash: string | null; last4: string | null; merchant: string | null },
): EarlierUnmatchedRefund | null {
  const gap = (r: EarlierUnmatchedRefund) => Math.abs(Date.parse(r.log.received_at) - purchase.receivedAtMs)
  const sameAcct = (r: EarlierUnmatchedRefund) => !!purchase.last4 && !!r.log.account_last4 && tailsMatch(purchase.last4, r.log.account_last4)
  const nearest = (list: EarlierUnmatchedRefund[]) => [...list].sort((x, y) => gap(x) - gap(y))[0] ?? null
  return (
    refunds.find((r) => !!purchase.referenceHash && r.log.reference_hash === purchase.referenceHash) ??
    nearest(refunds.filter((r) => sameAcct(r) && gap(r) <= WINDOW_MINUTES * MINUTE_MS)) ??
    nearest(
      refunds.filter(
        (r) => sameAcct(r) && sameMerchant(purchase.merchant, r.log.merchant_normalized ?? r.log.clean_title) && Date.parse(r.log.received_at) >= purchase.receivedAtMs,
      ),
    )
  )
}

/**
 * A purchase was just booked as `expenseId`. If this user holds a live, unanswered unmatched-refund placeholder of the
 * same amount and currency that the purchase completes, the purchase takes the refund stamp and the placeholder is
 * retracted with this purchase's message as its cause (I4). The stamp goes first; if it fails nothing else changes.
 */
export async function adoptEarlierUnmatchedRefund(service: ServiceClient, row: SmsRowData, expenseId: string): Promise<boolean> {
  if (!row.logId) return false
  const { data: placeholders } = await service
    .from('expenses')
    .select('id, sms_log_id, refund_sms_log_id, refunded_at, sms_flags, sms_flags_ack')
    .eq('user_id', row.userId)
    .eq('currency', row.currency as never)
    .eq('amount', row.amount)
    .eq('refund_kind', 'refunded')
    .is('deleted_at', null)
    .not('sms_log_id', 'is', null)
    .neq('id', expenseId)
    .limit(CANDIDATE_LIMIT)
  const live = (placeholders ?? []).filter(
    (p) => p.refund_sms_log_id === p.sms_log_id && !!p.refunded_at && p.sms_flags?.includes('refund_unmatched') && !p.sms_flags_ack?.includes('refund_unmatched'),
  )
  if (live.length === 0) return false
  const { data: logs } = await service
    .from('sms_parse_log')
    .select('id, received_at, reference_hash, account_last4, merchant_normalized, clean_title')
    .eq('user_id', row.userId)
    .in('id', live.map((p) => p.sms_log_id as string))
  const refunds = live.flatMap((p) => {
    const log = (logs ?? []).find((l) => l.id === p.sms_log_id)
    return log ? [{ expenseId: p.id, refundedAt: p.refunded_at as string, log: log as EarlierUnmatchedRefund['log'] }] : []
  })
  const at = row.receivedAtIso ? Date.parse(row.receivedAtIso) : NaN
  const match = pickEarlierUnmatchedRefund(refunds, {
    receivedAtMs: at,
    referenceHash: row.referenceHash ?? null,
    last4: row.last4 ?? null,
    merchant: row.merchantNormalized ?? row.merchant,
  })
  if (!match) return false

  const stamp = await service
    .from('expenses')
    .update({ refunded_at: match.refundedAt, refund_kind: 'refunded', refund_sms_log_id: match.log.id })
    .eq('id', expenseId)
    .eq('user_id', row.userId)
    .is('refunded_at', null)
    .is('deleted_at', null)
    .select('id')
  if (stamp.error || !stamp.data?.length) return false

  const retire = await service
    .from('expenses')
    .update({ deleted_at: new Date().toISOString(), retracted_by_sms_log_id: row.logId })
    .eq('id', match.expenseId)
    .eq('user_id', row.userId)
    .is('deleted_at', null)
    .select('id')
  if (retire.error || !retire.data?.length) {
    await service
      .from('expenses')
      .update({ refunded_at: null, refund_kind: null, refund_sms_log_id: null })
      .eq('id', expenseId)
      .eq('user_id', row.userId)
      .eq('refund_sms_log_id', match.log.id)
    return false
  }
  const log = await service.from('sms_parse_log').update({ expense_id: expenseId }).eq('id', match.log.id).eq('user_id', row.userId)
  if (log.error) console.warn('[sms/refund] adopted refund log not repointed', log.error.message)
  return true
}
