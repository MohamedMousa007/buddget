import type { BillingMe } from '@/lib/billing/billingStore'
import type { PlanOption } from '@/lib/billing/planOptions'
import { subscriptionView, type SubscriptionView } from '@/lib/billing/subscriptionView'
import type { ProThisMonth } from '@/lib/loyalty/rewardsTypes'

/** The owner's Pro prices (docs/launch/PRO_REWARDS_SPEC.md section 1): what the page shows until the store answers. The store's price wins. */
export type PriceRegion = 'EG' | 'AE' | 'SA' | 'QA' | 'US'
export const PRO_ANCHORS: Record<PriceRegion, { currency: string; monthly: number; yearly: number }> = {
  EG: { currency: 'EGP', monthly: 69.99, yearly: 499.99 },
  AE: { currency: 'AED', monthly: 19.99, yearly: 99.99 },
  SA: { currency: 'SAR', monthly: 19.99, yearly: 99.99 },
  QA: { currency: 'QAR', monthly: 19.99, yearly: 99.99 },
  US: { currency: 'USD', monthly: 4.99, yearly: 24.99 },
}
const BY_CURRENCY: Record<string, PriceRegion> = { EGP: 'EG', AED: 'AE', SAR: 'SA', QAR: 'QA' }

/** The price region for a person: their profile country first, then their base currency, else the USD prices. */
export function priceRegion(country: string | null | undefined, baseCurrency: string | null | undefined): PriceRegion {
  const c = country?.trim().toUpperCase()
  if (c && c in PRO_ANCHORS && c !== 'US') return c as PriceRegion
  return BY_CURRENCY[baseCurrency?.trim().toUpperCase() ?? ''] ?? 'US'
}

export const money = (currency: string, amount: number): string => `${currency} ${amount.toFixed(2)}`

export interface PlanDisplay {
  kind: 'annual' | 'monthly'
  price: string
  /** Yearly: the monthly equivalent. */
  perMonth: string | null
  /** Yearly: twelve months at the monthly price, struck through. */
  struck: string | null
  /** Yearly: whole percent saved against twelve monthly payments, rounded down. 0 hides the figure. */
  savePct: number
  /** The store package behind the plan; absent while the page shows the owner's prices. */
  option: PlanOption | null
}

/** Yearly then monthly. With store packages the store's own prices are shown; without them, the owner's prices for the region. */
export function planDisplays(region: PriceRegion, options: readonly PlanOption[]): PlanDisplay[] {
  const yearly = options.find((o) => o.kind === 'annual')
  const monthly = options.find((o) => o.kind === 'monthly')
  if (yearly || monthly) {
    const y = yearly?.pkg.product
    const m = monthly?.pkg.product
    const out: PlanDisplay[] = []
    if (yearly && y) {
      const twelve = m && m.price > 0 ? m.price * 12 : 0
      out.push({
        kind: 'annual',
        price: yearly.price,
        perMonth: yearly.perMonth ?? (y.price > 0 ? money(y.currencyCode, y.price / 12) : null),
        struck: m && twelve > y.price ? money(m.currencyCode, twelve) : null,
        savePct: twelve > y.price ? Math.floor((1 - y.price / twelve) * 100) : 0,
        option: yearly,
      })
    }
    if (monthly) out.push({ kind: 'monthly', price: monthly.price, perMonth: null, struck: null, savePct: 0, option: monthly })
    return out
  }
  const a = PRO_ANCHORS[region]
  const twelve = a.monthly * 12
  return [
    { kind: 'annual', price: money(a.currency, a.yearly), perMonth: money(a.currency, a.yearly / 12), struck: money(a.currency, twelve), savePct: Math.floor((1 - a.yearly / twelve) * 100), option: null },
    { kind: 'monthly', price: money(a.currency, a.monthly), perMonth: null, struck: null, savePct: 0, option: null },
  ]
}

/** Which of the three drawn pages a person gets: the Free showcase, the trial page or the member page. */
export type PlanPageState = 'free' | 'trial' | 'pro'
export function planPageState(view: SubscriptionView): PlanPageState {
  return view.kind === 'trial' ? 'trial' : view.proActive ? 'pro' : 'free'
}
export const planPageStateOf = (me: BillingMe | null): PlanPageState => planPageState(subscriptionView(me))

/** A paying store subscriber (not a trial, not a gift): the invite reward is Sparks instead of Pro time. */
export function isStoreSubscriber(me: BillingMe | null): boolean {
  const view = subscriptionView(me)
  return !!me?.subscription?.fromStore && view.proActive && view.kind !== 'trial'
}

const WEEKS_PER_MONTH = 4.35
/** A quick answer costs about 0.3 credits and a receipt scan about 3.1 (the cost table the Sparks blurbs use). */
const QUICK_COST = 0.3
const SCAN_COST = 3.1

export interface MonthTile {
  key: 'answers' | 'receipts' | 'credits' | 'views'
  value: number
  /** Where Free would have stopped, in the same unit. */
  cap: number
  /** True when the cap is an estimate (drawn with ≈). */
  approx: boolean
  /** The cap's place along the member's bar, 0 to 100. */
  capPct: number
  /** Whole-percent change on last month; null when there is nothing to compare. */
  deltaPct: number | null
}

export interface MonthView {
  /** How many times Free's monthly AI allowance this month's use came to. */
  multiple: number
  /** Free limits already passed this month. */
  passed: number
  tiles: MonthTile[]
}

const pct = (cap: number, value: number): number => (value > 0 ? Math.min(100, Math.max(0, Math.round((cap / value) * 100))) : 100)
const delta = (now: number, before: number): number | null => (before > 0 && now !== before ? Math.round(((now - before) / before) * 100) : null)

/**
 * "Pro this month" from real use. Free's monthly AI allowance is its weekly credits times the weeks in a month; answers and receipts
 * stop where that allowance would have run out at this person's own mix of use. View balance has an exact Free limit.
 */
export function monthView(month: ProThisMonth, balanceViewsUsed: number): MonthView {
  const allowance = Math.round((month.freeCaps.aiCreditsWeek ?? 0) * WEEKS_PER_MONTH)
  const used = month.creditsUsed.thisMonth
  const scale = used > 0 && allowance > 0 ? allowance / used : null
  const est = (value: number, unitCost: number): number => Math.max(1, Math.round(scale !== null && value > 0 ? value * scale : allowance / unitCost))
  const answersCap = est(month.aiAnswers.thisMonth, QUICK_COST)
  const receiptsCap = est(month.receiptsScanned.thisMonth, SCAN_COST)
  const viewsCap = month.freeCaps.balanceViewsPerMonth
  const tiles: MonthTile[] = [
    { key: 'answers', value: month.aiAnswers.thisMonth, cap: answersCap, approx: true, capPct: pct(answersCap, month.aiAnswers.thisMonth), deltaPct: delta(month.aiAnswers.thisMonth, month.aiAnswers.lastMonth) },
    { key: 'receipts', value: month.receiptsScanned.thisMonth, cap: receiptsCap, approx: true, capPct: pct(receiptsCap, month.receiptsScanned.thisMonth), deltaPct: delta(month.receiptsScanned.thisMonth, month.receiptsScanned.lastMonth) },
    { key: 'credits', value: Math.round(used), cap: allowance, approx: true, capPct: pct(allowance, used), deltaPct: delta(used, month.creditsUsed.lastMonth) },
  ]
  if (viewsCap !== null) tiles.push({ key: 'views', value: balanceViewsUsed, cap: viewsCap, approx: false, capPct: pct(viewsCap, balanceViewsUsed), deltaPct: null })
  return {
    multiple: allowance > 0 ? used / allowance : 0,
    passed: tiles.filter((t) => t.value > t.cap).length,
    tiles,
  }
}

/** "7×": whole from 10 up, one decimal below. */
export function multipleLabel(multiple: number): string {
  const rounded = multiple >= 10 ? Math.round(multiple) : Math.round(multiple * 10) / 10
  return `${rounded}×`
}
