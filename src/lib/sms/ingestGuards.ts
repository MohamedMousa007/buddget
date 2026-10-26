import crypto from 'crypto'
import { isNonTransaction, type NonTransactionReason } from '@/lib/sms/patterns/preFilter'
import { Constants } from '@/lib/supabase/database.types'
import type { Database } from '@/lib/supabase/database.types'
import type { ServiceClient } from '@/lib/supabase/service'

type CurrencyCode = Database['public']['Enums']['currency_code']

const HASH_BUCKET_MS = 2 * 60_000
const DEFAULT_TIMEZONE = 'Africa/Cairo'
const MAX_AMOUNT = 1_000_000_000
const MAX_FUTURE_DAYS = 2
const MAX_PAST_DAYS = 400
const STALE_PROCESSING_MS = 90_000

/**
 * Dedup hash over the normalized SMS body plus the receive time rounded to a ~2 minute bucket, so a
 * client retry of one SMS collapses while the same "debited EGP 99.00 for NETFLIX" a month later does not.
 * Without a client timestamp only the body is hashed: the server clock would differ on every retry.
 */
export function computeSmsHash(message: string, receivedAt?: string): string {
  return hashForBucket(message, receivedAt, 0)
}

function hashForBucket(message: string, receivedAt: string | undefined, offset: number): string {
  const normalized = message.trim().replace(/\s+/g, ' ').toLowerCase()
  const ms = receivedAt ? Date.parse(receivedAt) : NaN
  const bucket = Number.isFinite(ms) ? `|${Math.floor(ms / HASH_BUCKET_MS) + offset}` : ''
  return crypto.createHash('sha256').update(normalized + bucket).digest('hex')
}

/** Hashes of the buckets next to the current one: a retry straddling a bucket edge hashes into a neighbour. */
export function computeNeighbourSmsHashes(message: string, receivedAt?: string): string[] {
  if (!receivedAt || !Number.isFinite(Date.parse(receivedAt))) return []
  return [-1, 1].map((offset) => hashForBucket(message, receivedAt, offset))
}

/** Calendar day (yyyy-MM-dd) of an instant in the given timezone. */
export function smsLocalDay(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export type SmsPlausibilityIssue = 'implausible_amount' | 'implausible_date'

/** Rejects what no real SMS carries: non-positive or absurd amounts and dates far from today. */
export function smsPlausibilityIssue(amount: number, day: string, nowMs: number = Date.now()): SmsPlausibilityIssue | null {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return 'implausible_amount'
  const dayMs = Date.parse(`${day}T00:00:00Z`)
  const dayLength = 86_400_000
  if (!Number.isFinite(dayMs) || dayMs > nowMs + MAX_FUTURE_DAYS * dayLength || dayMs < nowMs - MAX_PAST_DAYS * dayLength) {
    return 'implausible_date'
  }
  return null
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
