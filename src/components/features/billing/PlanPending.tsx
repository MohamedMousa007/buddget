'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useBillingStore } from '@/lib/billing/billingStore'
import { useUsageCopy } from '@/lib/i18n/usageCopy'

/** What a plan-driven page shows while `me` is missing: a skeleton, or "Couldn't load your plan" with Try again once the read failed. */
export function PlanPending({ rows = 5 }: { rows?: number }) {
  const c = useUsageCopy()
  const error = useBillingStore((s) => s.error)
  const refresh = useBillingStore((s) => s.refresh)
  if (!error) return <SkeletonList rows={rows} />
  return <EmptyState title={c.page.planErrorTitle} description={c.page.planErrorBody} action={<Button size="touch" onClick={() => void refresh()}>{c.actions.tryAgain}</Button>} />
}
