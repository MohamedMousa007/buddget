import { isPlus, type EntitlementWrite, type RcEvent } from './revenuecat'

/**
 * Billing log type of a purchase read from RevenueCat on demand (POST /api/billing/sync). It is outside the history filter
 * (`INITIAL_PURCHASE`, `RENEWAL`), so when the real webhook lands its row is the one listed, not both.
 */
export const SYNC_EVENT_TYPE = 'SYNC_PURCHASE'

// ponytail: fallback for a subscription whose entitlements do not list its product. RevenueCat product id -> store id, iOS app
// app5008c2628f (list-products, 2026-11-20). Add the Play products here when they are created.
const STORE_ID_OF: Readonly<Record<string, string>> = { prodc5ccfbb979: 'pro_monthly', prod0ad078c15f: 'pro_annual' }

/** The fields read from a REST v2 Subscription (`GET /v2/projects/{project}/customers/{customer}/subscriptions`). Times are ms. */
interface RcV2Subscription {
  product_id?: string | null
  store?: string | null
  environment?: string | null
  gives_access?: boolean
  status?: string | null
  auto_renewal_status?: string | null
  current_period_starts_at?: number | null
  current_period_ends_at?: number | null
  ends_at?: number | null
  country?: string | null
  entitlements?: { items?: Array<{ products?: { items?: Array<{ id?: string; store_identifier?: string }> } }> } | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The store's product id (`pro_monthly`): from the entitlement's product list, else the catalogue map above. */
function storeProductId(sub: RcV2Subscription): string | null {
  if (!sub.product_id) return null
  for (const ent of sub.entitlements?.items ?? []) {
    const found = ent.products?.items?.find((p) => p.id === sub.product_id)?.store_identifier
    if (found) return found
  }
  return STORE_ID_OF[sub.product_id] ?? null
}

export interface SyncedPurchase {
  /** A purchase event for `planEffects`, stamped at the period start with an id that repeats for the same period and state. */
  ev: RcEvent
  /** What the subscription shows beyond a purchase: a renewal turned off or a billing problem. */
  patch: Partial<EntitlementWrite>
}

/**
 * The live Pro subscription in a v2 subscriptions list, or null when there is none. Live is RevenueCat's own `gives_access` on an
 * App Store or Play subscription: this path grants what a missed webhook should have and never takes access away (an expiry or a
 * refund keeps coming from the webhook), so a trial is never ended by it.
 */
export function syncedPurchase(body: unknown, userId: string): SyncedPurchase | null {
  const items = (body as { items?: RcV2Subscription[] } | null)?.items
  let best: { productId: string; sub: RcV2Subscription; purchasedMs: number; expirationMs: number } | null = null
  for (const sub of Array.isArray(items) ? items : []) {
    if (!sub || sub.gives_access !== true || (sub.store !== 'app_store' && sub.store !== 'play_store')) continue
    const productId = storeProductId(sub)
    const purchasedMs = num(sub.current_period_starts_at)
    const expirationMs = num(sub.current_period_ends_at)
    if (!isPlus(productId) || purchasedMs === null || expirationMs === null) continue
    if (!best || expirationMs > best.expirationMs) best = { productId: productId!, sub, purchasedMs, expirationMs }
  }
  if (!best) return null
  const { productId, sub, purchasedMs, expirationMs } = best
  const issue = sub.status === 'in_billing_retry' || sub.status === 'in_grace_period'
  const canceled = sub.auto_renewal_status === 'will_not_renew'
  const state = issue ? 'issue' : canceled ? 'canceled' : 'active'
  const graceMs = sub.status === 'in_grace_period' ? (num(sub.ends_at) ?? expirationMs) : null
  const ev: RcEvent = {
    type: 'INITIAL_PURCHASE',
    id: `sync:${userId}:${productId}:${purchasedMs}:${state}`,
    appUserId: userId,
    eventMs: purchasedMs,
    productId,
    store: sub.store as 'app_store' | 'play_store',
    purchasedMs,
    expirationMs,
    graceMs,
    cancelReason: null,
    // store_subscription_identifier is the latest transaction, not the original one; the webhook fills store_original_txn.
    originalTxn: null,
    transferredFrom: [],
    transferredTo: [],
    transactionId: null,
    // No store price on a v2 subscription (only USD revenue); the webhook brings the real price.
    priceMicros: null,
    currency: null,
    countryCode: typeof sub.country === 'string' && sub.country.length === 2 ? sub.country : null,
    sandbox: sub.environment === 'sandbox',
  }
  const patch: Partial<EntitlementWrite> = issue
    ? { status: 'past_due', grace_ends_at: graceMs === null ? null : new Date(graceMs).toISOString() }
    : canceled ? { status: 'canceled', will_renew: false } : {}
  return { ev, patch }
}
