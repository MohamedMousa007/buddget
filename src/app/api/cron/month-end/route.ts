/**
 * GET /api/cron/month-end  (daily 05:00 UTC, vercel.json; replaces month-carry, LOGIC_SPEC §4.4)
 *
 * (a) Pending cards whose 72 h are up are applied (ORDER BY auto_apply_at LIMIT 25, savings_month_summary_due_idx).
 * (b) Users whose cycle ended get their card: at most 25 per run (month_end_due_users keyset, one month_end_ledger call
 * each). Every outcome writes the user's row (a cycle that cannot be figured is closed empty), so the next run's keyset
 * starts with the next users. 50 s budget; `nextCursor` says where the run stopped (`?after=` resumes from there).
 * Writes only with MONTH_END_WRITES=on: otherwise it counts what it would do and writes nothing. Counts only, never user ids.
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { dueUsers, fetchRates, must, type DueUser } from '@/lib/server/monthEndLedger'
import { applyMonthEnd, proposeMonthEnd } from '@/lib/server/monthEnd'

export const maxDuration = 60
const PAGE = 25
const TIME_BUDGET_MS = 50_000
const RETRY_MS = 24 * 3600 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rates = await fetchRates()
  if (Object.keys(rates).length === 0) {
    console.error('[cron/month-end] FX rates unavailable, aborting')
    return NextResponse.json({ error: 'FX rates unavailable' }, { status: 503 })
  }
  const service = createServiceRoleClient()
  const writes = process.env.MONTH_END_WRITES === 'on'
  const started = Date.now()
  const late = () => Date.now() - started > TIME_BUDGET_MS
  const n = { applied: 0, conflicts: 0, proposed: 0, due: 0, failed: 0 }

  // (a) auto-apply
  const { data: pending } = must(await service.from('savings_month_summary').select('id, user_id, version')
    .eq('status', 'proposed').lte('auto_apply_at', new Date().toISOString()).order('auto_apply_at', { ascending: true }).limit(PAGE), 'due proposals')
  for (const p of pending ?? []) {
    if (late()) break
    n.due++
    if (!writes) continue
    try {
      const r = await applyMonthEnd(service, p.user_id, p.id, p.version, 'auto', rates)
      if (r.outcome === 'applied') { n.applied++; continue }
      if (r.outcome === 'conflict') { n.conflicts++; continue }
      n.failed++
      console.error('[cron/month-end] apply not done', r.outcome)
    } catch (e) {
      n.failed++
      console.error('[cron/month-end] apply failed', e instanceof Error ? e.message : e)
    }
    // Anything but applied or a lost version race: pushed back a day, so one card cannot hold the head of the queue.
    await service.from('savings_month_summary').update({ auto_apply_at: new Date(Date.now() + RETRY_MS).toISOString() }).eq('id', p.id).eq('status', 'proposed')
  }

  // (b) new cards: up to 25 due users per run (windows with none due are skipped without reading a ledger)
  let after = new URL(request.url).searchParams.get('after')
  let partial = false
  const due: DueUser[] = []
  for (;;) {
    const page = await dueUsers(service, { after, limit: PAGE - due.length })
    due.push(...page.users)
    // 25 reached: the rest wait for the next run (each one now has a row, so the keyset moves on by itself).
    if (due.length >= PAGE) { after = due[due.length - 1]!.userId; break }
    if (!page.nextAfter) { after = null; break }
    after = page.nextAfter
    if (late()) { partial = true; break }
  }
  for (const u of due) {
    if (late()) { partial = true; after = u.userId; break }
    n.due++
    if (!writes) continue
    try {
      if (await proposeMonthEnd(service, u.userId, rates, Date.now(), u)) n.proposed++
    } catch (e) {
      n.failed++
      console.error('[cron/month-end] propose failed', e instanceof Error ? e.message : e)
    }
  }
  if (partial) console.error('[cron/month-end] time budget reached; resume with ?after=<cursor>')
  return NextResponse.json({ ok: n.failed === 0 && !partial, ...(writes ? {} : { paused: true }), ...(partial ? { partial: true } : {}), ...(after ? { nextCursor: after } : {}), ...n })
}

// pg_cron + pg_net call with POST; Vercel crons call GET. Same handler, same auth.
export const POST = GET
