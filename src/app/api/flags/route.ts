import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { flagOn } from '@/lib/flags/evaluate'
import { createServiceRoleClient } from '@/lib/supabase/service'

const PLATFORMS = ['ios', 'android', 'web']

/** Which feature flags are on for the signed-in user, after rollout, platform and plan targeting. */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const asked = new URL(request.url).searchParams.get('platform') ?? 'web'
  const platform = PLATFORMS.includes(asked) ? asked : 'web'
  const service = createServiceRoleClient()
  const [rows, staff, ent] = await Promise.all([
    service.from('feature_flags').select('key, enabled, rollout_pct, platforms, plan_keys'),
    service.from('admin_staff').select('id').eq('user_id', uid).eq('status', 'active').maybeSingle(),
    getUserEntitlements(service, uid),
  ])
  const ctx = { userId: uid, platform, planKey: ent.planKey, isStaff: staff.data != null }
  const flags = Object.fromEntries((rows.data ?? []).map((r) => [r.key, flagOn(r, ctx)]))
  return NextResponse.json({ flags }, { headers: { 'Cache-Control': 'private, no-store' } })
}
