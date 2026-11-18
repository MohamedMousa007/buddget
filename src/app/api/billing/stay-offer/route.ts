import { NextResponse } from 'next/server'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'
import { stayEligibility, type StayOfferState } from '@/lib/billing/stayOffer'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/** Is the signed-in member offered a stay offer when they tap to cancel? One `stay_offer_state` call (docs/launch/STORE_SETUP.md). */
export async function GET(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await createServiceRoleClient().rpc('stay_offer_state', { p_user: identity.id })
  if (error) {
    console.error('[stay-offer] state failed', error.message)
    return NextResponse.json({ eligible: false })
  }
  return NextResponse.json(stayEligibility((data as StayOfferState | null) ?? null))
}

/**
 * The app bought the discounted package: stamp the redemption now, before the webhook lands (Apple does not always put the
 * offer id on the event). Idempotent: the first stamp wins.
 */
export async function POST(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await createServiceRoleClient().from('user_entitlements').update({ stay_offer_redeemed_at: new Date().toISOString() }).eq('user_id', identity.id).is('stay_offer_redeemed_at', null)
  if (error) console.error('[stay-offer] stamp failed', error.message)
  return NextResponse.json({ ok: !error })
}
