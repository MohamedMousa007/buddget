/**
 * GET /api/cron/loyalty  (Vercel Cron, daily)
 *
 * Proposes founder candidates (it never issues a number: an admin approves each account), closes the budget and month periods
 * that pay points, and runs `rewards_daily` (set-based, bounded, 20-second budget): invite activation checks and rewards, banked
 * Pro weeks whose start has come, and Pro-gated tiers whose Pro ran out.
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
  const rewards = await service.rpc('rewards_daily', { p_budget_ms: 20_000 })
  if (proposed.error) console.error('[cron/loyalty] founders failed', proposed.error.message)
  if (closed.error) console.error('[cron/loyalty] close failed', closed.error.message)
  if (rewards.error) console.error('[cron/loyalty] rewards failed', rewards.error.message)
  const ok = !proposed.error && !closed.error && !rewards.error
  return NextResponse.json({ ok, proposed: proposed.data ?? 0, pointsPaid: closed.data ?? 0, rewards: rewards.data ?? null }, { status: ok ? 200 : 500 })
}
