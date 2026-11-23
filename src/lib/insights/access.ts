import { billingOn, type BillingMe } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import type { ReportRangePreset } from '@/lib/reports/reportsPeriod'

/** Ranges Free keeps (the membership copy promises "the last 3 months"). */
export const FREE_RANGES: readonly ReportRangePreset[] = ['thisMonth', 'lastMonth', 'last3Months']

/**
 * Pro insights: every finding, the 6-month and year ranges. UI-only, like the other gates.
 * Billing off (or unknown) opens everything; otherwise the server's `features` list decides, which honours per-user
 * overrides, and a missing list falls back to the plan.
 */
export function canSeeAdvancedInsights(me: BillingMe | null | undefined): boolean {
  if (!billingOn(me)) return true
  if (me?.features) return me.features.includes('advanced_reports')
  return subscriptionView(me ?? null).proActive
}

export const rangeIsFree = (r: ReportRangePreset) => FREE_RANGES.includes(r)
