'use client'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
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
}

/** How many charges before we suggest tracking it. */
const MIN_SIGHTINGS = 2
/** Charges within this band are "the same subscription" rather than two purchases. */
const AMOUNT_SPREAD = 0.15
const LOOKBACK_DAYS = 90

type Row = {
  merchant: string | null
  merchant_normalized: string | null
  clean_title: string | null
  amount: number | null
  currency: string | null
  day: string | null
}

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
 */
export function useSubscriptionDetector(): DetectedSubscription[] {
  const { smsEnabled, subscriptions } = useFinanceStore(
    useShallow((s) => ({
      smsEnabled: s.settings.smsTrackingEnabled,
      subscriptions: s.subscriptions,
    })),
  )
  const [detected, setDetected] = useState<DetectedSubscription[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    void createClient()
      .from('sms_parse_log')
      .select('merchant, merchant_normalized, clean_title, amount, currency, day')
      .eq('parsed_ok', true)
      .in('kind', ['purchase', 'online_purchase'])
      .gte('created_at', since)
      // Ascending so `days[days.length - 1]` is genuinely the LATEST sighting's billing day,
      // not an arbitrary DB order.
      .order('day', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        // Already tracked — including cancelled, so a cancelled sub isn't re-suggested.
        const tracked = new Set(subscriptions.map((s) => s.brandKey).filter(Boolean))

        const groups = new Map<string, Row[]>()
        for (const row of data as Row[]) {
          if (!row.amount) continue
          const key =
            resolveBrandKeyFromMerchant(row.merchant_normalized) ??
            resolveBrandKeyFromMerchant(row.clean_title) ??
            resolveBrandKeyFromMerchant(row.merchant)
          if (!key || tracked.has(key)) continue
          const list = groups.get(key)
          if (list) list.push(row)
          else groups.set(key, [row])
        }

        const result: DetectedSubscription[] = []
        for (const [brandKey, rows] of groups) {
          if (rows.length < MIN_SIGHTINGS) continue
          const brand = findBrandByKey(brandKey)
          if (!brand) continue

          // One currency at a time — a brand charged in two currencies is not one
          // recurring plan we can describe.
          const currency = rows[0].currency ?? ''
          const sameCurrency = rows.filter((r) => (r.currency ?? '') === currency)
          if (sameCurrency.length < MIN_SIGHTINGS) continue

          const amounts = sameCurrency.map((r) => r.amount!)
          const mid = median(amounts)
          // Consistent price is what separates a subscription from repeat purchases at
          // the same merchant.
          const consistent = amounts.filter((a) => Math.abs(a - mid) / mid <= AMOUNT_SPREAD)
          if (consistent.length < MIN_SIGHTINGS) continue

          const days = sameCurrency.map((r) => Number(r.day?.slice(8, 10))).filter((d) => d >= 1 && d <= 31)
          result.push({
            brandKey,
            name: brand.name,
            amount: Math.round(mid * 100) / 100,
            currency,
            billingDay: days.length ? days[days.length - 1] : new Date().getDate(),
            sightings: consistent.length,
          })
        }
        setDetected(result)
      })
  }, [smsEnabled, subscriptions])

  return detected
}
