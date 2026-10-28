import type { Database } from '@/lib/supabase/database.types'
import type { ServiceClient } from '@/lib/supabase/service'
import { extractKeywords } from '@/lib/sms/keywordExtractor'
import { smsSkeleton } from '@/lib/sms/skeleton'
import { TXN_KEYWORD_RE } from '@/lib/sms/patterns/currency'
import type { NonTransactionReason } from '@/lib/sms/patterns/preFilter'

type Outbox = Database['public']['Tables']['sms_stats_outbox']['Insert']

export interface SmsStatsInput {
  userId: string
  /** The stable sender identity; always given when known (the corpus keys on it). */
  senderKey: string | null
  message: string
  /** Template that parsed this message, if any (counts a match and the user as a contributor). */
  templateId: string | null
  /** False for an independent agreement recorded for the template's evidence only. */
  countMatch?: boolean
  /** Learned sender currency, when this SMS produced a transaction. */
  currency: { value: Database['public']['Enums']['currency_code']; confirmed: boolean } | null
  /** True when this SMS counts toward the keyword and sender pools (a transaction was posted or matched). */
  isTransaction: boolean
  parsedOk: boolean
  kind: string | null
  parseMethod: string | null
  currencyCode: string | null
  /** Why the pre-filter rejected this message, when it did. Feeds filter tuning (LF7); an OTP never reaches the corpus. */
  rejectReason?: NonTransactionReason | null
}

/** Corpus kind that tags a shape the filter rejected although it reads like a transaction: an example for filter tuning. */
export const REJECTED_TX_LIKE_KIND = 'rejected_tx_like'

const AMOUNT_WITH_DECIMALS = /\d[\d,]*[.,]\d{2}(?!\d)/

/**
 * LF7: marketing/balance-only rejections whose text carries a transaction verb AND an amount are
 * candidates for filter tuning. OTP bodies are never tagged (and never kept: see buildStatsRow).
 */
export function rejectedExampleTag(message: string, reason: NonTransactionReason | null | undefined): typeof REJECTED_TX_LIKE_KIND | null {
  if (!reason || reason === 'otp') return null
  return TXN_KEYWORD_RE.test(message) && AMOUNT_WITH_DECIMALS.test(message) ? REJECTED_TX_LIKE_KIND : null
}

/** One cheap insert per SMS. A scheduled drain turns these into batched updates of the pools, counters and corpus. */
export function buildStatsRow(i: SmsStatsInput): Outbox {
  const tokens = i.isTransaction ? extractKeywords(i.message) : []
  const skeleton = i.rejectReason === 'otp' ? null : smsSkeleton(i.message, i.senderKey)
  const tag = rejectedExampleTag(i.message, i.rejectReason)
  return {
    sender: i.isTransaction ? i.senderKey : null,
    is_txn: i.isTransaction,
    kw: tokens.map((t) => t.keyword),
    kw_lang: tokens.map((t) => t.lang),
    template_id: i.templateId,
    user_id: i.userId,
    bump_match: i.countMatch ?? true,
    ccy_sender: i.currency && i.senderKey ? i.senderKey : null,
    ccy_currency: i.currency?.value ?? null,
    ccy_confirmed: i.currency?.confirmed ?? null,
    skeleton_key: skeleton?.key ?? null,
    sender_key: i.senderKey,
    redacted_body: skeleton?.redacted ?? null,
    kind: tag ?? i.kind,
    parse_method: i.parseMethod,
    currency: i.currencyCode,
    parsed_ok: i.parsedOk,
  }
}

export async function recordSmsStats(service: ServiceClient, input: SmsStatsInput): Promise<void> {
  const { error } = await service.from('sms_stats_outbox').insert(buildStatsRow(input))
  if (error) console.warn('[sms/stats] outbox insert failed', error.message)
}
