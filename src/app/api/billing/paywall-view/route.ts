import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'
import { billingEnabled } from '@/lib/entitlements/billingSwitch'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** Records one paywall view (S5c item 27). The country comes from the profile on the server; nothing is recorded while billing is off. */
export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const service = createServiceRoleClient()
  if (!(await billingEnabled(service))) return NextResponse.json({ ok: true, recorded: false })
  // QA-52: a view per screen open is plenty; fail open so a counter blip never errors the paywall.
  if (await isRateLimited(service, `paywall-view:${identity.id}`, 3600, 20, true)) return NextResponse.json({ ok: true, recorded: false })
  const body = ((await request.json().catch(() => null)) ?? {}) as { platform?: string; source?: string }
  const { error } = await service.rpc('record_paywall_view', { p_user: identity.id, p_platform: String(body.platform ?? ''), p_source: String(body.source ?? '') })
  if (error) console.error('[paywall-view] failed', error.message)
  return NextResponse.json({ ok: !error, recorded: !error })
}
