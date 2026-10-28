/**
 * GET /api/cron/sms-harvest  (Vercel Cron, daily)
 *
 * Backfills the masked shape (learned_at, masked_version, masked_body, skeleton_key) of SMS rows that predate it,
 * a few bounded batches per run, then reports counts and the leak scan over what was produced. Counts only.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { harvestBatch, type LeakScanResult } from '@/lib/sms/harvest'
import { sweepMaskedStores } from '@/lib/sms/remaskStores'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

const MAX_BATCHES = 5
const TIME_BUDGET_MS = 40_000
const SWEEP_DEADLINE_MS = 55_000

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()
  const started = Date.now()
  let processed = 0
  let batches = 0
  let legacy = false
  const leaks: LeakScanResult = { rowsScanned: 0, rowsWithLeaks: 0, byKind: {} }

  try {
    while (batches < MAX_BATCHES && Date.now() - started < TIME_BUDGET_MS) {
      const batch = await harvestBatch(service)
      batches++
      legacy = batch.legacy
      processed += batch.processed
      leaks.rowsScanned += batch.leaks.rowsScanned
      leaks.rowsWithLeaks += batch.leaks.rowsWithLeaks
      for (const [kind, n] of Object.entries(batch.leaks.byKind)) leaks.byKind[kind] = (leaks.byKind[kind] ?? 0) + n
      if (batch.processed === 0) break
    }
  } catch (e) {
    console.error('[cron/sms-harvest] failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, processed, batches, legacy, leaks }, { status: 500 })
  }

  // The leak-scan stamp that unlocks raw-text retention is earned here, never by hand: only a COMPLETE sweep of the
  // corpus, corrections and masked log bodies with zero leaks (and a clean harvest) stamps it; any leak clears it.
  const sweep = await sweepMaskedStores(service, () => Date.now() - started > SWEEP_DEADLINE_MS)
  const clean = sweep.complete && sweep.rowsWithLeaks === 0 && leaks.rowsWithLeaks === 0 && !legacy
  let stamped = false
  if (clean || sweep.rowsWithLeaks > 0 || leaks.rowsWithLeaks > 0) {
    const { error } = await service.from('platform_settings')
      .upsert({ key: 'sms_leak_scan_passed_at', value: clean ? new Date().toISOString() : null }, { onConflict: 'key' })
    stamped = clean && !error
  }
  return NextResponse.json({ ok: true, processed, batches, legacy, leaks, sweep, stamped })
}
