import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { flagOn } from '@/lib/flags/evaluate'
import { cachedSetting } from '@/lib/server/platformCache'
import { createServiceRoleClient } from '@/lib/supabase/service'

const PLATFORMS = ['ios', 'android', 'web']
const FLAGS_TTL_SECONDS = 60

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
    cachedSetting(['feature-flags'], async () => {
      const { data, error } = await service.from('feature_flags').select('key, enabled, rollout_pct, platforms, plan_keys')
      if (error) throw error
      return data
    }, FLAGS_TTL_SECONDS).catch(() => []),
    service.from('admin_staff').select('id').eq('user_id', uid).eq('status', 'active').maybeSingle(),
    getUserEntitlements(service, uid),
  ])
  const ctx = { userId: uid, platform, planKey: ent.planKey, isStaff: staff.data != null }
  const flags = Object.fromEntries(rows.map((r) => [r.key, flagOn(r, ctx)]))
  return NextResponse.json({ flags }, { headers: { 'Cache-Control': 'private, no-store' } })
}
