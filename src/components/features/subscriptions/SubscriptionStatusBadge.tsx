'use client'

import { Badge } from '@/components/ui/badge'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import type { SubscriptionDisplayStatus } from '@/lib/subscriptions/subscriptionStatus'
import { cn } from '@/lib/utils'

const TONE: Record<SubscriptionDisplayStatus, 'positive' | 'brand' | 'warn' | 'negative' | 'neutral'> = {
  active: 'positive',
  trial: 'brand',
  payment_due: 'warn',
  needs_renewal: 'negative',
  cancelled: 'neutral',
}

/** The derived subscription status (Active, Trial, Payment due, Needs renewal, Cancelled): one badge on rows and the sheet. */
export function SubscriptionStatusBadge({ status, className }: { status: SubscriptionDisplayStatus; className?: string }) {
  const c = useDebtsSubsLtCopy().subs
  return <Badge tone={TONE[status]} className={cn('uppercase tracking-[0.04em]', className)}>{c.status[status]}</Badge>
}
