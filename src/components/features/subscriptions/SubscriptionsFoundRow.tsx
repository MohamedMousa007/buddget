'use client'

import { MessageSquare } from 'lucide-react'
import { PendingRow } from '@/components/ui/PendingRow'
import { useSubscriptionDetector } from '@/hooks/useSubscriptionDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

/**
 * "Found 3 possible subscriptions": one row for every recurring SMS charge the user has not answered yet, on the page
 * where the answer is given. It creates nothing itself; the review sheet does, after the user confirms.
 */
export function SubscriptionsFoundRow() {
  const sms = useT().subscriptions.ui.sms
  const { finds } = useSubscriptionDetector()
  const openReview = useSettingsStore((s) => s.setSubscriptionReviewOpen)
  if (finds.length === 0) return null
  return <PendingRow tone="teal" icon={MessageSquare} title={sms.prompt(finds.length)} subtitle={sms.nothingAdded} onPress={() => openReview(true)} />
}
