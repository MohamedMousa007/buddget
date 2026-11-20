import { isPlus, type EntitlementWrite, type RcEvent } from './revenuecat'

/**
 * Billing log type of a purchase read from RevenueCat on demand (POST /api/billing/sync). It is outside the history filter
 * (`INITIAL_PURCHASE`, `RENEWAL`), so when the real webhook lands its row is the one listed, not both.
 */
export const SYNC_EVENT_TYPE = 'SYNC_PURCHASE'

interface RcSubscription {
  expires_date?: string | null
  purchase_date?: string | null
  store?: string | null
  is_sandbox?: boolean
  unsubscribe_detected_at?: string | null
  billing_issues_detected_at?: string | null
  grace_period_expires_date?: string | null
  refunded_at?: string | null
  price?: { amount?: number | null; currency?: string | null } | null
}

const ms = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

export interface SyncedPurchase {
  /** A purchase event for `planEffects`, stamped at the purchase time with an id that repeats for the same period and state. */
  ev: RcEvent
  /** What the subscriber shows beyond a purchase: a cancelled renewal or a billing problem. */
  patch: Partial<EntitlementWrite>
}

/**
 * The live Pro subscription in a `GET /v1/subscribers/{id}` body, or null when there is none. Only a store subscription that
 * has not expired and was not refunded counts: this path grants what a missed webhook should have, it never takes access away
 * (an expiry or refund keeps coming from the webhook), so a trial is never ended by it.
 */
export function syncedPurchase(body: unknown, userId: string, nowMs: number): SyncedPurchase | null {
  const root = body as { request_date_ms?: number; subscriber?: { subscriptions?: Record<string, RcSubscription> } } | null
  const now = typeof root?.request_date_ms === 'number' ? root.request_date_ms : nowMs
  let best: { productId: string; sub: RcSubscription; purchasedMs: number; expirationMs: number } | null = null
  for (const [productId, sub] of Object.entries(root?.subscriber?.subscriptions ?? {})) {
    const purchasedMs = ms(sub?.purchase_date)
    const expirationMs = ms(sub?.expires_date)
    if (!isPlus(productId) || purchasedMs === null || expirationMs === null || expirationMs <= now || sub.refunded_at) continue
    if (sub.store !== 'app_store' && sub.store !== 'play_store') continue
    if (!best || expirationMs > best.expirationMs) best = { productId, sub, purchasedMs, expirationMs }
  }
  if (!best) return null
  const { productId, sub, purchasedMs, expirationMs } = best
  const amount = typeof sub.price?.amount === 'number' && Number.isFinite(sub.price.amount) ? sub.price.amount : null
  const issue = sub.billing_issues_detected_at != null
  const unsubscribed = ms(sub.unsubscribe_detected_at)
  const state = issue ? 'issue' : unsubscribed !== null ? 'canceled' : 'active'
  const ev: RcEvent = {
    type: 'INITIAL_PURCHASE',
    id: `sync:${userId}:${productId}:${purchasedMs}:${state}`,
    appUserId: userId,
    eventMs: purchasedMs,
    productId,
    store: sub.store as 'app_store' | 'play_store',
    purchasedMs,
    expirationMs,
    graceMs: ms(sub.grace_period_expires_date),
    cancelReason: null,
    originalTxn: null,
    transferredFrom: [],
    transferredTo: [],
    transactionId: null,
    priceMicros: amount === null ? null : Math.round(amount * 1_000_000),
    currency: sub.price?.currency ?? null,
    sandbox: sub.is_sandbox === true,
  }
  const patch: Partial<EntitlementWrite> = issue
    ? { status: 'past_due', grace_ends_at: ev.graceMs === null ? null : new Date(ev.graceMs).toISOString() }
    : unsubscribed !== null ? { status: 'canceled', will_renew: false, canceled_at: new Date(unsubscribed).toISOString() } : {}
  return { ev, patch }
}
