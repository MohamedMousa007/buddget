import { NextResponse } from 'next/server'
import { parseEvent, planEffects, type EntitlementWrite } from '@/lib/billing/revenuecat'
import { verifyRevenueCatRequest } from '@/lib/billing/webhookAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const FOREIGN_KEY_VIOLATION = '23503'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const reply = (outcome: string) => NextResponse.json({ ok: true, outcome })
const STAY_PURCHASE_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE'])
const STAY_CLAIM_WINDOW_MS = 3_600_000

/**
 * RevenueCat webhook (S5c items 13 and 14). Service role only; no user session. Order of work: verify both the
 * Authorization secret and the HMAC signature on the raw body (before it is parsed), decide what the event means
 * (pure, src/lib/billing/revenuecat.ts), and let `billing_apply` record the event once and write the effect in one
 * transaction. Answers 2xx only after that commit, so a failure is retried by the sender; an event that is a replay,
 * older than what is stored, or not about a Plus product is answered 2xx and not retried. Only the event id and type
 * are ever logged, never the payload.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  const verdict = verifyRevenueCatRequest(raw, request.headers, {
    authorization: process.env.REVENUECAT_WEBHOOK_AUTH,
    hmac: process.env.REVENUECAT_WEBHOOK_HMAC_SECRET,
  })
  if (verdict === 'not_configured') return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  if (verdict !== 'ok') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const ev = parseEvent(body)
  if (!ev) return NextResponse.json({ error: 'invalid_event' }, { status: 400 })

  const service = createServiceRoleClient()
  let source: EntitlementWrite | null = null
  if (ev.type === 'TRANSFER') {
    const from = ev.transferredFrom.find((id) => UUID.test(id))
    if (from) {
      const { data } = await service.from('user_entitlements')
        .select('plan_key, status, source, trial_ends_at, current_period_end, canceled_at, will_renew, product_id, store, store_original_txn, grace_ends_at')
        .eq('user_id', from).maybeSingle()
      source = (data as EntitlementWrite | null) ?? null
    }
  }

  const { data: packs } = await service.from('spark_products').select('product_id').eq('active', true)
  const effect = planEffects(ev, source, new Set((packs ?? []).map((p) => p.product_id)), process.env.REVENUECAT_ACCEPT_SANDBOX === '1')
  if (effect === 'ignore') {
    const { error } = await service.rpc('billing_note', { p_user: (UUID.test(ev.appUserId) ? ev.appUserId : null) as string, p_event_id: ev.id, p_type: ev.type, p_event_ms: ev.eventMs })
    if (error) console.warn('[billing] note failed', ev.id, ev.type, error.message)
    return reply('ignored')
  }

  const { data, error } = await service.rpc('billing_apply', {
    p_user: effect.userId,
    p_event_id: ev.id,
    p_type: ev.type,
    p_event_ms: ev.eventMs,
    // Keys that do not apply are left out, not sent as null: the database reads a missing key as nothing to do.
    p_effect: JSON.parse(JSON.stringify({ entitlement: effect.entitlement ?? undefined, sparks: effect.sparks ?? undefined, endTrial: effect.endTrial ?? false, transfer: effect.transfer, pack: effect.pack, receipt: effect.receipt, country: effect.country })),
  })
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      console.error('[billing] event for a user that does not exist', ev.id, ev.type)
      return reply('unknown_user')
    }
    console.error('[billing] apply failed', ev.id, ev.type, error.message)
    return NextResponse.json({ error: 'apply_failed' }, { status: 500 })
  }
  // One stay offer per account per lifetime: the first stamp wins; a replayed event changes nothing. Spent when the event names
  // the offer, or when it is a purchase within an hour of the app saying it bought the offer (S8G-04, stay_offer_claim).
  const stamp = () => service.from('user_entitlements').update({ stay_offer_redeemed_at: new Date(ev.eventMs).toISOString() }).eq('user_id', effect.userId).is('stay_offer_redeemed_at', null)
  const stayStamp = effect.stayOffer
    ? stamp()
    : STAY_PURCHASE_TYPES.has(ev.type)
      ? stamp().gte('stay_offer_claimed_at', new Date(ev.eventMs - STAY_CLAIM_WINDOW_MS).toISOString()).lte('stay_offer_claimed_at', new Date(ev.eventMs + STAY_CLAIM_WINDOW_MS).toISOString())
      : null
  if (stayStamp) {
    const { error: stampError } = await stayStamp
    if (stampError) console.error('[billing] stay offer stamp failed', ev.id, ev.type, stampError.message)
  }
  return reply(String(data))
}
