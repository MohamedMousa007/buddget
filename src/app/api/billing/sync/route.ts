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
 * "Confirming with the store": the buyer asks the server to read their RevenueCat customer now, for a webhook that never came
 * (BDG-019). User-triggered only, never on a plain read; the signed-in user is the only customer it reads. A live Pro
 * subscription goes through the same `planEffects` and `billing_apply` as the webhook, stamped at its purchase time with an id
 * that repeats for the same period, so a repeat tap is `duplicate`, the real webhook still applies after it, and the Sparks
 * period opens once (`spark_allowances` is unique on its start). It never removes access.
 */
export async function POST(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return reply('Not authenticated', 401)
  const key = process.env.REVENUECAT_SECRET_KEY?.trim()
  if (!key) return reply('not_configured', 503)

  const service = createServiceRoleClient()
  if (!(await billingEnabled(service))) return reply('billing_off')
  if (await isRateLimited(service, `billing-sync:${identity.id}`, 60, 6, true)) return reply('rate_limited', 429)

  let body: unknown
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(identity.id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn('[billing] sync read failed', res.status)
      return reply('store_unavailable', 502)
    }
    body = await res.json()
  } catch {
    return reply('store_unavailable', 502)
  }

  const found = syncedPurchase(body, identity.id, Date.now())
  if (!found) return reply('none')
  const effect = planEffects(found.ev, null, new Set(), process.env.REVENUECAT_IGNORE_SANDBOX !== '1')
  if (effect === 'ignore' || !effect.entitlement) return reply('ignored')

  const { data, error } = await service.rpc('billing_apply', {
    p_user: identity.id,
    p_event_id: found.ev.id,
    p_type: SYNC_EVENT_TYPE,
    p_event_ms: found.ev.eventMs,
    p_effect: JSON.parse(JSON.stringify({ entitlement: { ...effect.entitlement, ...found.patch }, sparks: effect.sparks ?? undefined, endTrial: effect.endTrial ?? false, receipt: effect.receipt })),
  })
  if (error) {
    console.error('[billing] sync apply failed', found.ev.id, error.message)
    return reply('apply_failed', 500)
  }
  return reply(String(data))
}
