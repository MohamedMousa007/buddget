/**
 * POST /api/month-end (LOGIC_SPEC §4.4): the month-end card.
 *   { op: 'propose' }               on opening Savings: creates the card for a cycle that just ended, re-proposes a
 *                                   pending one, returns the latest card (or null).
 *   { op: 'apply', id, version }    Confirm. 409 when another apply (or the cron) won the version.
 *   { op: 'undo', id }              Undo. 409 when a shortfall answer used the money (N3) or it is not applied.
 *   { op: 'split', split }          The split's only writer: Σ ≤ 100 (422 "over"), own live targets; re-proposes.
 * The client never sends lines, amounts or held figures: the server computes them from the ledger.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isRateLimited } from '@/lib/server/rateLimit'
import { fetchRates } from '@/lib/server/monthEndLedger'
import { applyMonthEnd, proposeMonthEnd, saveSplit, undoMonthEnd } from '@/lib/server/monthEnd'

const body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('propose') }),
  z.object({ op: z.literal('apply'), id: z.string().uuid(), version: z.number().int().min(1) }),
  z.object({ op: z.literal('undo'), id: z.string().uuid() }),
  z.object({ op: z.literal('split'), split: z.array(z.object({ target_id: z.string().uuid(), pct: z.number() })).max(50) }),
])

const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)
  if (!userId) return fail('Unauthorized', 401)
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('Invalid body', 400)
  const service = createServiceRoleClient()
  if (await isRateLimited(service, `month-end:${userId}`, 60, 30)) return fail('Too many requests', 429)
  const b = parsed.data

  try {
    if (b.op === 'undo') {
      const r = await undoMonthEnd(service, userId, b.id)
      if (r.outcome === 'not_found') return fail('Not found', 404)
      return NextResponse.json(r, { status: r.outcome === 'undone' ? 200 : 409 })
    }
    const rates = await fetchRates()
    // The split is saved without live rates (a pending card re-proposes at its own stored rates).
    if (b.op === 'split') {
      const r = await saveSplit(service, userId, b.split, rates)
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.reason }, { status: 422 })
    }
    if (Object.keys(rates).length === 0) return fail('FX rates unavailable', 503)
    if (b.op === 'propose') return NextResponse.json({ view: await proposeMonthEnd(service, userId, rates) })
    const r = await applyMonthEnd(service, userId, b.id, b.version, 'user', rates)
    if (r.outcome === 'not_found') return fail('Not found', 404)
    if (r.outcome === 'no_rates') return fail('FX rates unavailable', 503)
    return NextResponse.json(r, { status: r.outcome === 'applied' ? 200 : 409 })
  } catch (e) {
    console.error('[month-end]', b.op, e instanceof Error ? e.message : e)
    return fail('Month end failed', 500)
  }
}
