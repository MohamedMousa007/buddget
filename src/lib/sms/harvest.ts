import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceClient } from '@/lib/supabase/service'
import { scanForLeaks } from '@/lib/sms/maskPii'
import { effectiveSender } from '@/lib/sms/routingKey'
import { smsSkeleton } from '@/lib/sms/skeleton'

const BATCH = 200
const STAMP_CONCURRENCY = 20

/** Version of the masking rules behind masked_body; raise it when maskPii changes so older rows are re-masked. */
export const MASKER_VERSION = 1

/** Postgres undefined_column (select) and PostgREST schema-cache miss (write): the lifecycle migration is not applied yet. */
const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204'])
const isMissingColumn = (error: { code?: string } | null): boolean => !!error?.code && MISSING_COLUMN_CODES.has(error.code)

export interface LeakScanResult {
  rowsScanned: number
  rowsWithLeaks: number
  byKind: Record<string, number>
}

/** Runs the independent leak scan over masked bodies. Returns counts only, never the text or what matched. */
export function scanMaskedBodies(bodies: readonly string[]): LeakScanResult {
  const result: LeakScanResult = { rowsScanned: bodies.length, rowsWithLeaks: 0, byKind: {} }
  for (const body of bodies) {
    const findings = scanForLeaks(body)
    if (findings.length) result.rowsWithLeaks++
    for (const f of findings) result.byKind[f.kind] = (result.byKind[f.kind] ?? 0) + f.count
  }
  return result
}

export interface HarvestResult {
  /** Rows handled in this batch. */
  processed: number
  /** True when the lifecycle columns are missing and the legacy harvested_at behaviour ran instead. */
  legacy: boolean
  leaks: LeakScanResult
}

const EMPTY_LEAKS: LeakScanResult = { rowsScanned: 0, rowsWithLeaks: 0, byKind: {} }

interface HarvestRow {
  id: string
  sender: string | null
  raw_body: string | null
  bank_name: string | null
  parsed_ok: boolean | null
  kind: string | null
  parse_method: string | null
  currency: string | null
  harvested_at?: string | null
}

const SELECT_COLUMNS = 'id, sender, raw_body, bank_name, status, parsed_ok, kind, parse_method, currency, harvested_at'

/**
 * Moves what raw SMS text teaches into the redacted corpus and stamps each row with its masked shape
 * (learned_at, masked_version, masked_body, skeleton_key), so raw text can later be removed without losing what
 * it taught. harvested_at is set at ingest on every row and does NOT mean learned; learned_at is the real flag.
 * Rows already counted at ingest (harvested_at set) are only stamped, never fed to the corpus a second time.
 * Idempotent; each call handles one bounded batch. Before the lifecycle migration is applied it falls back to the
 * old behaviour (feed the corpus for rows with harvested_at null, mark harvested_at).
 */
export async function harvestBatch(typed: ServiceClient, limit = BATCH): Promise<HarvestResult> {
  // The lifecycle columns are absent from the generated types until their migration is applied and types regenerate.
  const service = typed as unknown as SupabaseClient
  const size = Math.max(1, Math.min(limit, BATCH))
  const { data: rows, error } = await service
    .from('sms_parse_log')
    .select(SELECT_COLUMNS)
    .is('learned_at', null)
    .not('raw_body', 'is', null)
    .neq('status', 'processing')
    .order('received_at', { ascending: true })
    .limit(size)
  if (isMissingColumn(error)) return harvestLegacyOnly(service, size)
  if (error || !rows?.length) return { processed: 0, legacy: false, leaks: EMPTY_LEAKS }

  const shaped = (rows as HarvestRow[]).map((r) => {
    const body = r.raw_body ?? ''
    const senderKey = effectiveSender(r.sender, body, r.bank_name)
    return { row: r, senderKey, sk: smsSkeleton(body, senderKey) }
  })

  // Stamp FIRST: a row is fed to the corpus only after its stamp stuck, so a failed stamp can never make the same
  // rows come back and be counted twice. A failed outbox insert after that loses one batch of counts (at-most-once),
  // never duplicates them.
  const now = new Date().toISOString()
  const stamped: typeof shaped = []
  for (let i = 0; i < shaped.length; i += STAMP_CONCURRENCY) {
    const chunk = shaped.slice(i, i + STAMP_CONCURRENCY)
    const results = await Promise.all(chunk.map(({ row, sk }) =>
      service.from('sms_parse_log').update({
        learned_at: now,
        harvested_at: row.harvested_at ?? now,
        masked_version: MASKER_VERSION,
        masked_body: sk?.redacted ?? null,
        skeleton_key: sk?.key ?? null,
      }).eq('id', row.id)))
    chunk.forEach((entry, k) => { if (!results[k]!.error) stamped.push(entry) })
  }
  if (stamped.length < shaped.length) console.warn('[sms/harvest] some rows could not be stamped')
  if (!stamped.length) return { processed: 0, legacy: false, leaks: EMPTY_LEAKS }

  const outbox = stamped.flatMap(({ row, senderKey, sk }) =>
    sk && !row.harvested_at
      ? [{
          sender: null, is_txn: false, user_id: null, skeleton_key: sk.key, sender_key: senderKey, redacted_body: sk.redacted,
          kind: row.kind, parse_method: row.parse_method, currency: row.currency, parsed_ok: row.parsed_ok,
        }]
      : [])
  if (outbox.length) {
    const { error: insertError } = await service.from('sms_stats_outbox').insert(outbox)
    if (insertError) console.warn('[sms/harvest] outbox insert failed', insertError.message)
  }

  return { processed: stamped.length, legacy: false, leaks: scanMaskedBodies(stamped.flatMap(({ sk }) => (sk ? [sk.redacted] : []))) }
}

async function harvestLegacyOnly(service: SupabaseClient, size: number): Promise<HarvestResult> {
  const { data: rows, error } = await service
    .from('sms_parse_log')
    .select('id, sender, raw_body, bank_name, status, parsed_ok, kind, parse_method, currency')
    .is('harvested_at', null)
    .not('raw_body', 'is', null)
    .neq('status', 'processing')
    .order('received_at', { ascending: true })
    .limit(size)
  if (error || !rows?.length) return { processed: 0, legacy: true, leaks: EMPTY_LEAKS }

  const outbox = (rows as HarvestRow[]).flatMap((r) => {
    const senderKey = effectiveSender(r.sender, r.raw_body ?? '', r.bank_name)
    const sk = smsSkeleton(r.raw_body ?? '', senderKey)
    return sk
      ? [{
          sender: null, is_txn: false, user_id: null, skeleton_key: sk.key, sender_key: senderKey, redacted_body: sk.redacted,
          kind: r.kind, parse_method: r.parse_method, currency: r.currency, parsed_ok: r.parsed_ok,
        }]
      : []
  })
  if (outbox.length) {
    const { error: insertError } = await service.from('sms_stats_outbox').insert(outbox)
    if (insertError) {
      console.warn('[sms/harvest] outbox insert failed', insertError.message)
      return { processed: 0, legacy: true, leaks: EMPTY_LEAKS }
    }
  }
  const { error: markError } = await service.from('sms_parse_log').update({ harvested_at: new Date().toISOString() }).in('id', (rows as HarvestRow[]).map((r) => r.id))
  if (markError) console.warn('[sms/harvest] mark failed', markError.message)
  return { processed: rows.length, legacy: true, leaks: scanMaskedBodies(outbox.map((o) => o.redacted_body)) }
}

/** One batch; returns how many rows were handled. */
export async function harvestLegacySms(service: ServiceClient, limit = BATCH): Promise<number> {
  return (await harvestBatch(service, limit)).processed
}
