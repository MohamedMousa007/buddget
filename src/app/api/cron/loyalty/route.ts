/**
 * GET /api/cron/loyalty  (Vercel Cron, daily)
 *
 * Proposes founder candidates (it never issues a number: an admin approves each account) and closes the budget and month
 * periods that pay points. Both are no-ops until the launch migration writes the founder window, and tiers are off.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceRoleClient()
  const proposed = await service.rpc('loyalty_grant_founders')
  const closed = await service.rpc('loyalty_close_periods')
  if (proposed.error) console.error('[cron/loyalty] founders failed', proposed.error.message)
  if (closed.error) console.error('[cron/loyalty] close failed', closed.error.message)
  const ok = !proposed.error && !closed.error
  return NextResponse.json({ ok, proposed: proposed.data ?? 0, pointsPaid: closed.data ?? 0 }, { status: ok ? 200 : 500 })
}
