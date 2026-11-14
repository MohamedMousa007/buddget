/**
 * GET  /api/savings/carry: how far the last closed months' posted carry has drifted from their rows now (read-only).
 * POST /api/savings/carry { monthKey }: brings that one month's carry up to date, only while it is still stale.
 * The cron never recomputes a closed month by itself; this runs on the user's tap.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { applyCarryDrift } from '@/lib/server/carryAdjust'
import { closedCycleDrift, fetchRates, type CycleDriftItem } from '@/lib/server/carryCycle'

const bodySchema = z.object({ monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status })
const view = ({ monthKey, posted, recomputed, delta, stale, currency }: CycleDriftItem) => ({ monthKey, posted, recomputed, delta, stale, currency })

async function context(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)
  if (!userId) return fail('Unauthorized', 401)
  const rates = await fetchRates()
  if (Object.keys(rates).length === 0) return fail('FX rates unavailable', 503)
  const service = createServiceRoleClient()
  const { data } = await service.from('user_settings').select('month_start_day').eq('user_id', userId).maybeSingle()
  return { userId, rates, service, monthStartDay: (data?.month_start_day as number | null) ?? 1 }
}

export async function GET(request: Request) {
  const c = await context(request)
  if (c instanceof NextResponse) return c
  try {
    const found = await closedCycleDrift(c.service, c.userId, c.monthStartDay, c.rates)
    return NextResponse.json({ cycles: found.map((f) => view(f.item)) })
  } catch (e) {
    console.error('[savings/carry] read failed', e instanceof Error ? e.message : e)
    return fail('Failed to read carry', 500)
  }
}

export async function POST(request: Request) {
  const c = await context(request)
  if (c instanceof NextResponse) return c
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('Invalid body', 400)
  try {
    const { cycle, unapplied, outcome } = await applyCarryDrift(c.service, c.userId, parsed.data.monthKey, c.monthStartDay, c.rates)
    if (!cycle) return fail('Not found', 404)
    return NextResponse.json({ cycle: view(cycle), unapplied, outcome })
  } catch (e) {
    console.error('[savings/carry] apply failed', e instanceof Error ? e.message : e)
    return fail('Failed to update carry', 500)
  }
}
