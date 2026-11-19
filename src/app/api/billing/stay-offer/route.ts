import { NextResponse } from 'next/server'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'
import { billingEnabled } from '@/lib/entitlements/billingSwitch'
import { stayEligibility, type StayOfferState } from '@/lib/billing/stayOffer'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/** Is the signed-in member offered a stay offer when they tap to cancel? One `stay_offer_state` call (docs/launch/STORE_SETUP.md). */
export async function GET(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const service = createServiceRoleClient()
  // S8G-11: nothing is offered while selling is off, like every other billing route.
  if (!(await billingEnabled(service))) return NextResponse.json({ eligible: false })
  const { data, error } = await service.rpc('stay_offer_state', { p_user: identity.id })
  if (error) {
    console.error('[stay-offer] state failed', error.message)
    return NextResponse.json({ eligible: false })
  }
  return NextResponse.json(stayEligibility((data as StayOfferState | null) ?? null))
}

/**
 * The app bought the discounted package. S8G-04: this only records the claim; the offer is spent when a store purchase is
 * seen within an hour of it (here, or in the webhook), so a tap that never became a purchase keeps the offer.
 */
export async function POST(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await createServiceRoleClient().rpc('stay_offer_claim', { p_user: identity.id })
  if (error) console.error('[stay-offer] claim failed', error.message)
  return NextResponse.json({ ok: !error })
}
