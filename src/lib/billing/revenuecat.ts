/**
 * What a RevenueCat webhook event means for a user's plan and Sparks. Pure: no database, no clock. The route verifies the
 * request, calls `planEffects`, and hands the result to the `billing_apply` SQL function, which records the event once,
 * refuses an older one and writes the effect in one transaction (see supabase/migrations/0293_s6_billing.sql).
 *
 * Mapping (S5c items 9, 10, 14, S5a section 8):
 *   INITIAL_PURCHASE, RENEWAL          active Plus to the period end; the only two that open a Sparks period
 *   UNCANCELLATION                     active again; never grants Sparks
 *   CANCELLATION                       canceled: access runs to the period end. Reason CUSTOMER_SUPPORT is a refund: expired now, Sparks period ended
 *   REFUND_REVERSED                    active again, the refunded Sparks period reopened
 *   BILLING_ISSUE                      past_due with the store's grace expiry (null = the resolver's fallback of period end + 3 days)
 *   EXPIRATION                         expired, Sparks period ended
 *   TRANSFER                           the subscription moves to the receiving user; the old rows expire; no Sparks
 * Ignored: PRODUCT_CHANGE (a notice only; the RENEWAL or INITIAL_PURCHASE that follows applies it) and
 * SUBSCRIPTION_PAUSED (Google Play, scheduled for the period end; RevenueCat: "Don't revoke access on this event",
 * the EXPIRATION that follows ends it), a pack purchase, TEST, a product that is not Plus, an anonymous app user.
 */

export type BillingStore = 'app_store' | 'play_store'

export interface RcEvent {
  type: string
  id: string
  appUserId: string
  eventMs: number
  productId: string | null
  store: BillingStore | null
  purchasedMs: number | null
  expirationMs: number | null
  graceMs: number | null
  cancelReason: string | null
  originalTxn: string | null
  transferredFrom: string[]
  transferredTo: string[]
  transactionId: string | null
  /** What the store charged, in millionths of the purchase currency. */
  priceMicros: number | null
  currency: string | null
}

export interface EntitlementWrite {
  plan_key: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'paused'
  source: 'apple' | 'google'
  trial_ends_at: string | null
  current_period_end: string | null
  canceled_at: string | null
  will_renew: boolean | null
  product_id: string | null
  store: BillingStore | null
  store_original_txn: string | null
  grace_ends_at: string | null
}

export type SparksEffect =
  | { action: 'open'; start: string; end: string; ref: 'store:monthly' | 'store:annual' }
  | { action: 'end' }
  | { action: 'restore' }

export type PackEffect =
  | { action: 'purchase'; store: string; store_txn: string; product_id: string; price_micros: number | null; currency: string | null }
  | { action: 'refund'; store_txn: string }

export interface ReceiptNote { store: BillingStore | null; product_id: string | null; price_micros: number | null; currency: string | null }

export interface BillingEffect {
  userId: string
  entitlement: EntitlementWrite | null
  sparks: SparksEffect | null
  /** A Sparks pack bought or refunded. */
  pack?: PackEffect
  /** What the store charged, kept on the billing log for the purchases list. */
  receipt?: ReceiptNote
  endTrial?: boolean
  transfer?: { from: string[] }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString())
const isAnnual = (product: string | null): boolean => !!product && product.startsWith('pro_annual')
const isPlus = (product: string | null): boolean => !!product && (product.startsWith('pro_monthly') || isAnnual(product))

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Reads the `event` object of a RevenueCat webhook body; null when it lacks a type, an id or a timestamp. */
export function parseEvent(body: unknown): RcEvent | null {
  const e = (body as { event?: Record<string, unknown> } | null)?.event
  if (!e || typeof e !== 'object') return null
  const type = str(e.type)
  const id = str(e.id)
  const eventMs = num(e.event_timestamp_ms)
  if (!type || !id || eventMs === null) return null
  const store = e.store === 'APP_STORE' ? 'app_store' : e.store === 'PLAY_STORE' ? 'play_store' : null
  return {
    type, id, eventMs, store,
    appUserId: str(e.app_user_id) ?? '',
    productId: str(e.product_id),
    purchasedMs: num(e.purchased_at_ms),
    expirationMs: num(e.expiration_at_ms),
    graceMs: num(e.grace_period_expiration_at_ms),
    cancelReason: str(e.cancel_reason),
    originalTxn: str(e.original_transaction_id),
    transferredFrom: ids(e.transferred_from),
    transferredTo: ids(e.transferred_to),
    transactionId: str(e.transaction_id),
    priceMicros: ((n) => (n === null ? null : Math.round(n * 1_000_000)))(num(e.price_in_purchased_currency)),
    currency: str(e.currency),
  }
}

/** One month after `ms` in UTC, never past `capMs`. */
function monthAfter(ms: number, capMs: number | null): number {
  const d = new Date(ms)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return capMs === null ? d.getTime() : Math.min(d.getTime(), capMs)
}

function entitlementOf(ev: RcEvent, over: Partial<EntitlementWrite>): EntitlementWrite {
  return {
    plan_key: 'plus',
    status: 'active',
    source: ev.store === 'play_store' ? 'google' : 'apple',
    trial_ends_at: null,
    current_period_end: iso(ev.expirationMs),
    canceled_at: null,
    will_renew: true,
    product_id: ev.productId,
    store: ev.store,
    store_original_txn: ev.originalTxn,
    grace_ends_at: null,
    ...over,
  }
}

/**
 * The effect of one event, or 'ignore'. `transferSource` is the entitlement the transferring user held (the route reads it);
 * a TRANSFER event itself carries no period or product.
 */
export function planEffects(ev: RcEvent, transferSource: EntitlementWrite | null = null, packIds: ReadonlySet<string> = new Set()): BillingEffect | 'ignore' {
  if (ev.type === 'TRANSFER') {
    const to = ev.transferredTo.find((id) => UUID.test(id))
    if (!to) return 'ignore'
    return { userId: to, entitlement: transferSource, sparks: null, transfer: { from: ev.transferredFrom.filter((id) => UUID.test(id)) } }
  }
  if (UUID.test(ev.appUserId) && ev.productId && packIds.has(ev.productId)) return packEffect(ev)
  if (!UUID.test(ev.appUserId) || !isPlus(ev.productId)) return 'ignore'
  const userId = ev.appUserId
  const withReceipt = (e: BillingEffect | 'ignore'): BillingEffect | 'ignore' =>
    e === 'ignore' ? e : { ...e, receipt: { store: ev.store, product_id: ev.productId, price_micros: ev.priceMicros, currency: ev.currency } }
  return withReceipt(subscriptionEffect(ev, userId))
}

/** A consumable Sparks pack: a purchase adds its Sparks (the server adds the Pro bonus), a refund removes the unspent ones. */
function packEffect(ev: RcEvent): BillingEffect | 'ignore' {
  if (!ev.transactionId || !ev.productId) return 'ignore'
  const base = { userId: ev.appUserId, entitlement: null, sparks: null }
  if (ev.type === 'NON_RENEWING_PURCHASE') {
    return { ...base, pack: { action: 'purchase', store: ev.store ?? 'unknown', store_txn: ev.transactionId, product_id: ev.productId, price_micros: ev.priceMicros, currency: ev.currency }, receipt: { store: ev.store, product_id: ev.productId, price_micros: ev.priceMicros, currency: ev.currency } }
  }
  if (ev.type === 'CANCELLATION') return { ...base, pack: { action: 'refund', store_txn: ev.transactionId } }
  return 'ignore'
}

function subscriptionEffect(ev: RcEvent, userId: string): BillingEffect | 'ignore' {

  switch (ev.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL': {
      if (ev.purchasedMs === null || ev.expirationMs === null) return 'ignore'
      const annual = isAnnual(ev.productId)
      const end = annual ? monthAfter(ev.purchasedMs, ev.expirationMs) : ev.expirationMs
      return {
        userId,
        entitlement: entitlementOf(ev, {}),
        sparks: { action: 'open', start: new Date(ev.purchasedMs).toISOString(), end: new Date(end).toISOString(), ref: annual ? 'store:annual' : 'store:monthly' },
        endTrial: true,
      }
    }
    case 'UNCANCELLATION':
      return { userId, entitlement: entitlementOf(ev, {}), sparks: null }
    case 'REFUND_REVERSED':
      return { userId, entitlement: entitlementOf(ev, {}), sparks: { action: 'restore' } }
    case 'CANCELLATION':
      if (ev.cancelReason === 'CUSTOMER_SUPPORT') {
        return { userId, entitlement: entitlementOf(ev, { status: 'expired', will_renew: false }), sparks: { action: 'end' } }
      }
      return { userId, entitlement: entitlementOf(ev, { status: 'canceled', will_renew: false, canceled_at: iso(ev.eventMs) }), sparks: null }
    case 'BILLING_ISSUE':
      return { userId, entitlement: entitlementOf(ev, { status: 'past_due', grace_ends_at: iso(ev.graceMs) }), sparks: null }
    case 'EXPIRATION':
      return { userId, entitlement: entitlementOf(ev, { status: 'expired', will_renew: false }), sparks: { action: 'end' } }
    default:
      return 'ignore'
  }
}
