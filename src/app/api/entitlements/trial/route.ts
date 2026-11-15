import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'
import { normalizeEmailKey, type TrialStatus } from '@/lib/entitlements/trial'
import { createServiceRoleClient } from '@/lib/supabase/service'

const noStore = { 'Cache-Control': 'private, no-store' }
const reply = (status: TrialStatus, extra: Record<string, unknown> = {}) => NextResponse.json({ status, ...extra }, { headers: noStore })

/**
 * Claims the 14-day Plus trial, once per verified, normalised email (S5c item 17). The server decides everything: the
 * sign-in must be verified (a confirmed email, which Google and Apple sign-in set), the key is built here, and the
 * database refuses a second claim, a day over the cap, an account that already has a plan, and any call while billing is off.
 */
export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const service = createServiceRoleClient()
  const { data: found } = await service.auth.admin.getUserById(identity.id)
  const user = found?.user
  if (!user?.email || !user.email_confirmed_at || user.is_anonymous) return reply('unverified')
  const emailKey = normalizeEmailKey(user.email)
  if (!emailKey) return reply('invalid_email')

  const { data, error } = await service.rpc('trial_claim', { p_user: identity.id, p_email_key: emailKey })
  if (error || !data) {
    console.error('[trial] claim failed', error?.message)
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: noStore })
  }
  const result = data as { status: TrialStatus; trial_ends_at?: string }
  return reply(result.status, result.trial_ends_at ? { trialEndsAt: result.trial_ends_at } : {})
}
