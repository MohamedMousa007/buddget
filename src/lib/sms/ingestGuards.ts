import crypto from 'crypto'
import { normalizeDigits } from '@/lib/sms/normalizeDigits'
import { isNonTransaction, type NonTransactionReason } from '@/lib/sms/patterns/preFilter'
import { Constants } from '@/lib/supabase/database.types'
import type { Database } from '@/lib/supabase/database.types'
import type { ServiceClient } from '@/lib/supabase/service'
import { ALL_PATTERN_SETS } from '@/lib/sms/patterns'
import type { SmsTxResult } from '@/lib/sms/dispatch'

type CurrencyCode = Database['public']['Enums']['currency_code']

const HASH_BUCKET_MS = 2 * 60_000
const DEFAULT_TIMEZONE = 'Africa/Cairo'
const MAX_AMOUNT = 1_000_000_000
const MAX_FUTURE_DAYS = 2
const MAX_PAST_DAYS = 400
const STALE_PROCESSING_MS = 90_000
/** Longer messages are cut to this (the money and the date sit at the front) instead of being refused forever. */
export const MAX_SMS_BODY_CHARS = 2000

/**
 * Dedup hash over the RAW SMS body as received (whitespace and case folded only; never bidi/digit-normalised,
 * so a retry from any build hashes the same). Matching and learning use `normalizeSmsText`, not this.
 * Dedup hash over the normalized SMS body plus the receive time rounded to a ~2 minute bucket, so a
 * client retry of one SMS collapses while the same "debited EGP 99.00 for NETFLIX" a month later does not.
 * Without a client timestamp only the body is hashed: the server clock would differ on every retry.
 */
export function computeSmsHash(message: string, receivedAt?: string, eventId?: string): string {
  return eventId ? hashForEvent(message, eventId) : hashForBucket(message, receivedAt, 0)
}

const foldBody = (message: string): string => message.trim().replace(/\s+/g, ' ').toLowerCase()

/** A capture id is the exact retry identity: twin purchases (different ids) both book, a retry (same id) collapses. */
function hashForEvent(message: string, eventId: string): string {
  return crypto.createHash('sha256').update(`${foldBody(message)}|evt:${eventId.toLowerCase()}`).digest('hex')
}

/**
 * The text alone, with the same folding as the capture-id hash and over the same raw message. Unlike `sms_hash` it does
 * not change with the capture id, so a copy re-sent under a new id still carries it (I5).
 */
export function computeBodyHash(message: string): string {
  return crypto.createHash('sha256').update(foldBody(message)).digest('hex')
}

/**
 * The capture time the phone reported, cut to the whole second, or null when it sent none or an unreadable one. Never
 * the server clock: a retry would get a different value and the same-capture index would never match.
 */
export function captureSecond(receivedAt: string | undefined): string | null {
  const ms = receivedAt ? Date.parse(receivedAt) : NaN
  return Number.isFinite(ms) ? new Date(Math.floor(ms / 1000) * 1000).toISOString() : null
}

function hashForBucket(message: string, receivedAt: string | undefined, offset: number): string {
  const normalized = message.trim().replace(/\s+/g, ' ').toLowerCase()
  const ms = receivedAt ? Date.parse(receivedAt) : NaN
  const bucket = Number.isFinite(ms) ? `|${Math.floor(ms / HASH_BUCKET_MS) + offset}` : ''
  return crypto.createHash('sha256').update(normalized + bucket).digest('hex')
}

/**
 * Hashes older builds stored for a body with Arabic digits (they hashed the digit-normalised text). A retry
 * is a duplicate if EITHER the raw-body hash or one of these is already held. Empty for ASCII-digit bodies.
 */
export function computeLegacySmsHashes(rawMessage: string, receivedAt?: string): string[] {
  const legacy = normalizeDigits(rawMessage)
  return legacy === rawMessage ? [] : [hashForBucket(legacy, receivedAt, 0)]
}

/** Hashes of the buckets next to the current one: a retry straddling a bucket edge hashes into a neighbour. */
export function computeNeighbourSmsHashes(message: string, receivedAt?: string, eventId?: string): string[] {
  if (eventId) return []
  if (!receivedAt || !Number.isFinite(Date.parse(receivedAt))) return []
  return [-1, 1].map((offset) => hashForBucket(message, receivedAt, offset))
}

/** Calendar day (yyyy-MM-dd) of an instant in the given timezone. */
export function smsLocalDay(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export type SmsPlausibilityIssue = 'implausible_amount' | 'implausible_date'

/** No real SMS carries a non-positive or absurd amount. */
export function isPlausibleAmount(amount: number | null | undefined): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT
}

/** A transaction day that is not more than 2 days ahead and not more than 400 days back. */
export function isPlausibleDay(day: string, nowMs: number = Date.now()): boolean {
  const dayMs = Date.parse(`${day}T00:00:00Z`)
  const dayLength = 86_400_000
  return Number.isFinite(dayMs) && dayMs <= nowMs + MAX_FUTURE_DAYS * dayLength && dayMs >= nowMs - MAX_PAST_DAYS * dayLength
}

/** Rejects what no real SMS carries: non-positive or absurd amounts and dates far from today. */
export function smsPlausibilityIssue(amount: number, day: string, nowMs: number = Date.now()): SmsPlausibilityIssue | null {
  if (!isPlausibleAmount(amount)) return 'implausible_amount'
  return isPlausibleDay(day, nowMs) ? null : 'implausible_date'
}

/**
 * The day a message is booked on, and whether it is a fallback. A date can never reject a message (I6), so an
 * untrustworthy one falls back: the body's own day when plausible, else the capture day, else the server's arrival day.
 * `unsure` is set only when a date the message printed (or the capture time the phone sent) could not be believed; a
 * message that prints no date and was captured on a believable day is simply dated by its capture, with no flag.
 * `arrivalDay` must come from the server clock, never from the client's reported time.
 */
export function resolveSmsDay(i: { bodyDay: string | null; captureDay: string | null; arrivalDay: string; nowMs?: number }): { day: string; unsure: boolean } {
  const nowMs = i.nowMs ?? Date.now()
  if (i.bodyDay && isPlausibleDay(i.bodyDay, nowMs)) return { day: i.bodyDay, unsure: false }
  const printedDateFailed = i.bodyDay != null
  if (i.captureDay && isPlausibleDay(i.captureDay, nowMs)) return { day: i.captureDay, unsure: printedDateFailed }
  return { day: i.arrivalDay, unsure: printedDateFailed || i.captureDay != null }
}

const SUPPORTED = new Set<string>(Constants.public.Enums.currency_code)

/** The DB currency enum member for a code, or null when it is not one. */
export function toSupportedCurrency(code: string | null | undefined): CurrencyCode | null {
  const upper = code?.trim().toUpperCase()
  return upper && SUPPORTED.has(upper) ? (upper as CurrencyCode) : null
}

/** A claim row that can never finish: a failed attempt, or a `processing` row whose function is long dead. */
export function isStaleClaim(status: string | null, parsedAt: string | null, nowMs: number = Date.now()): boolean {
  if (status === 'failed') return true
  return status === 'processing' && !!parsedAt && nowMs - Date.parse(parsedAt) > STALE_PROCESSING_MS
}

/** The pre-filter verdict, skipped when a curated pattern already recognised a real transaction (a purchase at "VODAFONE BUNDLE"). */
export function nonTransactionReason(message: string, curatedMatched: boolean): NonTransactionReason | null {
  return curatedMatched ? null : isNonTransaction(message)
}

/** True when a ledger row already references this log row, so retiring the claim would post it a second time. */
export async function hasPostedTransaction(service: ServiceClient, userId: string, logId: string): Promise<boolean> {
  const [expense, income] = await Promise.all([
    service.from('expenses').select('id').eq('user_id', userId).eq('sms_log_id', logId).limit(1),
    service.from('income_events').select('id').eq('user_id', userId).eq('sms_log_id', logId).limit(1),
  ])
  return (expense.data?.length ?? 0) > 0 || (income.data?.length ?? 0) > 0
}

/** A claim whose first delivery has not finished: the sender must keep its queued copy until that run ends. */
export function isClaimInFlight(status: string | null): boolean {
  return status === 'processing'
}

/** Not a 2xx: the device drain deletes the item on any success, and the first run may still die. */
export function claimInProgressResponse(): Response {
  return Response.json({ ok: false, reason: 'in_progress', retry: true }, { status: 409 })
}

/** Replaces every run of 4+ digits (a one-time code, a card tail) with '#', keeping the wording for the corpus. */
export function maskOtpDigits(message: string): string {
  return message.replace(/\d{4,}/g, '#')
}

const CREDIT_KINDS = new Set<string>(['income', 'instant_transfer_in', 'refund'])

export type SenderCheck = 'ok' | 'mismatch' | 'absent'

/**
 * Credits are auto-booked from a spoofable alphanumeric sender. When a sender IS present, a credit from a sender that is
 * not a known sender id is held for the user (the existing awaiting_confirmation path). "Known" is the matched bank's own
 * ids; a bank with none of its own (the generic Bank / Credit Card / Transfer / Currency Exchange sets, or a bank only
 * a template or the AI knows) falls back to every known bank sender id, so a real bank's sender is never held but an
 * arbitrary spoofed one is. An empty sender (iOS never sends one) is reported as 'absent' so the caller only counts it:
 * it never changes how the SMS is booked.
 */
export function checkCreditSender(bank: string | null | undefined, kind: string | null | undefined, sender: string | null | undefined): SenderCheck {
  if (!kind || !CREDIT_KINDS.has(kind)) return 'ok'
  const given = sender?.trim().toUpperCase()
  if (!given) return 'absent'
  const idsOf = (sets: typeof ALL_PATTERN_SETS) => sets.flatMap((set) => set.senderIds.map((id) => id.toUpperCase()))
  const own = idsOf(ALL_PATTERN_SETS.filter((set) => set.bank === bank))
  const known = own.length > 0 ? own : idsOf(ALL_PATTERN_SETS)
  // A real sender id often carries a suffix or prefix ("CIB-EG", "HSBC EG"): match on whole tokens, never substrings.
  const tokens = given.split(/[\s\-_.:]+/).filter(Boolean)
  const squashed = given.replace(/[^A-Z0-9\u0600-\u06FF]/g, '')
  return known.some((id) => id === given || id.replace(/[^A-Z0-9\u0600-\u06FF]/g, '') === squashed || tokens.includes(id)) ? 'ok' : 'mismatch'
}

/** The dispatcher outcome for a credit held for confirmation: nothing posted, the row stays claimable by /confirm. */
export function heldForConfirmation(kind: SmsTxResult['kind']): SmsTxResult {
  return {
    outcome: 'awaiting_confirmation', kind, expenseId: null, incomeId: null, debtPaymentId: null, category: null,
    confirmReason: null, matchedSourceId: null, linkedSubscriptionId: null, error: null,
  }
}
