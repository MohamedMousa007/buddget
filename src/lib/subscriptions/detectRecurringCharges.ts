import { findBrandByKey, resolveBrandKeyFromMerchant } from '@/lib/constants/subscriptionCatalog'

export interface DetectedSubscription {
  brandKey: string
  /** Catalog display name — the banner should never show the raw SMS merchant. */
  name: string
  /** Median charge seen. The amount actually billed beats any catalog price. */
  amount: number
  currency: string
  /** Day of month the charges landed on. */
  billingDay: number
  sightings: number
  /** Distinct months it was charged in — "three months running". */
  months: number
  /** Last few distinct charge days (`yyyy-MM-dd`), oldest first. */
  dates: string[]
  /** Evidence strength: three or more months running is high, a repeat pair is medium. */
  confidence: 'high' | 'medium'
  /** Redacted text of the latest matching SMS, for the review card. */
  excerpt: string | null
}

export type ChargeRow = {
  merchant: string | null
  merchant_normalized: string | null
  clean_title: string | null
  amount: number | null
  currency: string | null
  day: string | null
  raw_sms_summary?: string | null
}

/** How many charges before we suggest tracking it. */
export const MIN_SIGHTINGS = 2
/** Charges within this band are "the same subscription" rather than two purchases. */
const AMOUNT_SPREAD = 0.15

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Recurring charges at a catalog brand the user does NOT already track.
 *
 * Gated on {@link MIN_SIGHTINGS} repeats at a consistent amount, deliberately: a single
 * name match has nothing to corroborate it — that is exactly the shape that resolved
 * "Bosnia Air" to a streaming brand — and here a false positive nags the user to create a
 * subscription they do not have. Two charges at the same price is what makes it a
 * subscription rather than a purchase.
 *
 * `rows` must be ordered by `day` ascending so the last consistent row is the latest sighting.
 */
export function detectRecurringCharges(
  rows: ChargeRow[],
  trackedBrandKeys: ReadonlySet<string | null>,
  now: Date = new Date()
): DetectedSubscription[] {
  const groups = new Map<string, ChargeRow[]>()
  for (const row of rows) {
    if (!row.amount) continue
    const key =
      resolveBrandKeyFromMerchant(row.merchant_normalized) ??
      resolveBrandKeyFromMerchant(row.clean_title) ??
      resolveBrandKeyFromMerchant(row.merchant)
    if (!key || trackedBrandKeys.has(key)) continue
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }

  const result: DetectedSubscription[] = []
  for (const [brandKey, group] of groups) {
    const brand = findBrandByKey(brandKey)
    if (!brand) continue

    // One currency at a time — a brand charged in two currencies is not one recurring plan
    // we can describe. Take the most-seen currency rather than whichever row came first.
    const byCurrency = new Map<string, ChargeRow[]>()
    for (const r of group) {
      const c = r.currency ?? ''
      byCurrency.set(c, [...(byCurrency.get(c) ?? []), r])
    }
    const [currency, sameCurrency] = [...byCurrency.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    if (sameCurrency.length < MIN_SIGHTINGS) continue

    const mid = median(sameCurrency.map((r) => r.amount!))
    // Consistent price is what separates a subscription from repeat purchases at the same
    // merchant. Everything below describes ONLY those charges: an outlier purchase must not
    // set the billing day or the month count.
    const consistent = sameCurrency.filter((r) => Math.abs(r.amount! - mid) / mid <= AMOUNT_SPREAD)
    if (consistent.length < MIN_SIGHTINGS) continue

    const days = consistent.map((r) => Number(r.day?.slice(8, 10))).filter((d) => d >= 1 && d <= 31)
    const months = new Set(consistent.map((r) => r.day?.slice(0, 7))).size
    const seen = [...new Set(consistent.flatMap((r) => (r.day ? [r.day.slice(0, 10)] : [])))].slice(-3)
    result.push({
      brandKey,
      name: brand.name,
      amount: Math.round(mid * 100) / 100,
      currency,
      billingDay: days.length ? days[days.length - 1] : now.getDate(),
      sightings: consistent.length,
      months,
      dates: seen,
      confidence: months >= 3 && consistent.length >= 3 ? 'high' : 'medium',
      excerpt: consistent[consistent.length - 1].raw_sms_summary ?? null,
    })
  }
  return result
}
