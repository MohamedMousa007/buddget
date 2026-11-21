import { NextResponse } from 'next/server'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'
import { planEffects } from '@/lib/billing/revenuecat'
import { SYNC_EVENT_TYPE, syncedPurchase } from '@/lib/billing/revenuecatSync'
import { billingEnabled } from '@/lib/entitlements/billingSwitch'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store' }
const reply = (outcome: string, status = 200) => NextResponse.json(status === 200 ? { ok: true, outcome } : { error: outcome }, { status, headers: noStore })

/**
 * "Confirming with the store": the buyer asks the server to read their RevenueCat subscriptions now (REST v2, a read-only key
 * with `customer_information:subscriptions:read`), for a webhook that never came (BDG-019). User-triggered only, never on a plain read; the signed-in user is the only customer it reads. A live Pro
 * subscription goes through the same `planEffects` and `billing_apply` as the webhook, stamped at its purchase time with an id
 * that repeats for the same period and state, so a repeat tap is `duplicate` and the real webhook still applies after it.
 * It grants access only: no Sparks and no trial end, which stay with the webhook (a second Sparks period would open unless both
 * paths stamped the exact same start). It never removes access.
 */
export async function POST(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return reply('Not authenticated', 401)
  const key = process.env.REVENUECAT_SECRET_KEY?.trim()
  if (!key) return reply('not_configured', 503)
  const project = process.env.REVENUECAT_PROJECT_ID?.trim() || 'projb9480b99'

  const service = createServiceRoleClient()
  if (!(await billingEnabled(service))) return reply('billing_off')
  if (await isRateLimited(service, `billing-sync:${identity.id}`, 60, 6, true)) return reply('rate_limited', 429)

  let body: unknown
  try {
    const res = await fetch(`https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/customers/${encodeURIComponent(identity.id)}/subscriptions?limit=100`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    // RevenueCat has never seen this app user id: nothing was bought.
    if (res.status === 404) return reply('none')
    if (!res.ok) {
      console.warn('[billing] sync read failed', res.status)
      return reply('store_unavailable', 502)
    }
    body = await res.json()
  } catch {
    return reply('store_unavailable', 502)
  }

  const found = syncedPurchase(body, identity.id)
  if (!found) return reply('none')
  const effect = planEffects(found.ev, null, new Set(), process.env.REVENUECAT_IGNORE_SANDBOX !== '1')
  if (effect === 'ignore' || !effect.entitlement) return reply('ignored')

  const { data, error } = await service.rpc('billing_apply', {
    p_user: identity.id,
    p_event_id: found.ev.id,
    p_type: SYNC_EVENT_TYPE,
    p_event_ms: found.ev.eventMs,
    p_effect: JSON.parse(JSON.stringify({ entitlement: { ...effect.entitlement, ...found.patch }, endTrial: false, receipt: effect.receipt, country: effect.country })),
  })
  if (error) {
    console.error('[billing] sync apply failed', found.ev.id, error.message)
    return reply('apply_failed', 500)
  }
  return reply(String(data))
}
