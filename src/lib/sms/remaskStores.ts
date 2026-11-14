import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceClient } from '@/lib/supabase/service'
import { maskPii, scanForLeaks, type LeakKind } from '@/lib/sms/maskPii'
import { maskSkeletonText } from '@/lib/sms/skeleton'
import { maskTemplateSample } from '@/lib/sms/templateSample'

const PAGE = 200

interface Store {
  table: string
  key: string
  column: string
  remask: (text: string) => string
  /** Small decimals stay readable in correction exemplars by design (maskPii), so they are not a leak there. */
  ignore: LeakKind[]
}

const STORES: Store[] = [
  { table: 'sms_corpus', key: 'skeleton_key', column: 'redacted_body', remask: maskSkeletonText, ignore: [] },
  { table: 'sms_corrections', key: 'id', column: 'redacted_body', remask: maskPii, ignore: ['amount'] },
  { table: 'sms_parse_log', key: 'id', column: 'masked_body', remask: maskSkeletonText, ignore: [] },
  // Samples learned before they were masked hold a real message. Small decimals stay readable, as in corrections.
  { table: 'sms_tracking_templates_ai', key: 'id', column: 'template_sample', remask: maskTemplateSample, ignore: ['amount'] },
]

export interface SweepResult {
  rowsScanned: number
  remasked: number
  rowsWithLeaks: number
  /** True only when every row of every store was reached; a partial sweep proves nothing. */
  complete: boolean
}

/**
 * Re-masks every stored masked text through the current masker (idempotent: clean rows are not written), then
 * scans what is stored afterwards. Keyset-paged, counts only. The leak-scan stamp is only earned when
 * `complete` and `rowsWithLeaks === 0`; a row whose re-mask could not be written is scanned as it stands.
 */
export async function sweepMaskedStores(typed: ServiceClient, outOfTime: () => boolean): Promise<SweepResult> {
  const service = typed as unknown as SupabaseClient
  const result: SweepResult = { rowsScanned: 0, remasked: 0, rowsWithLeaks: 0, complete: true }

  for (const store of STORES) {
    let cursor = ''
    for (;;) {
      if (outOfTime()) return { ...result, complete: false }
      let q = service.from(store.table).select(`${store.key}, ${store.column}`).not(store.column, 'is', null)
      if (cursor) q = q.gt(store.key, cursor)
      const { data, error } = await q.order(store.key, { ascending: true }).limit(PAGE)
      if (error) return { ...result, complete: false }
      const rows = (data ?? []) as unknown as Array<Record<string, string>>
      if (!rows.length) break

      for (const row of rows) {
        const current = row[store.column]!
        let stored = current
        const masked = store.remask(current)
        if (masked !== current) {
          const { error: updateError } = await service.from(store.table).update({ [store.column]: masked }).eq(store.key, row[store.key]!)
          if (!updateError) {
            stored = masked
            result.remasked++
          }
        }
        result.rowsScanned++
        if (scanForLeaks(stored).some((f) => !store.ignore.includes(f.kind))) result.rowsWithLeaks++
      }
      cursor = rows[rows.length - 1]![store.key]!
      if (rows.length < PAGE) break
    }
  }
  return result
}
