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
import { normalizeMerchant } from './merchantNormalizer'
import { resolveExactPaymentMethod, providerOf, type SmsRowData } from './createSmsExpense'

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
const AMOUNT_EPSILON = 0.005
const REFUND_LOOKBACK_DAYS = 90
const WINDOW_MINUTES = 15
const DECLINE_TWIN_DAYS = 3
const CANDIDATE_LIMIT = 500

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
}

export type RefundRule = 'reference' | 'window' | 'merchant'

export interface RefundPick {
  candidate: RefundCandidate
  rule: RefundRule
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
  const add = (rule: RefundRule, list: typeof eligible): void => {
    for (const { c } of list) {
      if (taken.has(c.id)) continue
      taken.add(c.id)
      picks.push({ candidate: c, rule })
    }
  }

  add('reference', eligible.filter(({ c }) => !!refund.referenceHash && c.reference_hash === refund.referenceHash))
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
): Promise<{ id: string; category: string; rule: RefundRule } | null> {
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
  })
  if (picks.length === 0) return null

  const { data: expenses } = await service
    .from('expenses')
    .select('id, category, sms_log_id')
    .eq('user_id', row.userId)
    .in('id', picks.map((p) => p.candidate.expense_id as string))
    .is('deleted_at', null)
    .is('refunded_at', null)
    .neq('description', 'Transfer fee')
  for (const { candidate, rule } of picks) {
    const e = (expenses ?? []).find((x) => x.id === candidate.expense_id && x.sms_log_id === candidate.id)
    if (e) return { id: e.id, category: e.category as string, rule }
  }
  return null
}
