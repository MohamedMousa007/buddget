'use client'

import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { usePendingSmsStore } from '@/lib/store/usePendingSmsStore'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'
import { requestSmsReview } from '@/lib/sms/reviewRequest'
import { navigate } from '@/lib/navigation/navigate'
import { pendingCopy, pendingKinds, type PendingEntry, type PendingKind, type PendingLabels } from '@/lib/alerts/pendingSummary'

/** Teal = a review of something, amber = a balance is off until it is answered. */
export const PENDING_TONE: Record<PendingKind, 'teal' | 'amber'> = { heldMessages: 'teal', unplacedExpenses: 'amber' }

/** What is waiting on the user right now: the one list the Flow row and the Inbox both read. */
export function usePendingEntries(): PendingEntry[] {
  const held = usePendingSmsStore((s) => s.held)
  const unplaced = useFinanceStore((s) => unplacedSmsExpenses(s.expenses).length)
  return useMemo(() => pendingKinds([{ kind: 'heldMessages', count: held }, { kind: 'unplacedExpenses', count: unplaced }]), [held, unplaced])
}

export function usePendingLabels(): PendingLabels {
  const t = useT()
  return useMemo(
    () => ({
      mixedTitle: t.notifications.mixedTitle,
      label: (kind, count) => (kind === 'heldMessages' ? t.notifications.heldLabel(count) : t.notifications.unplacedLabel(count)),
      hint: (kind) => (kind === 'heldMessages' ? t.notifications.heldHint : t.accountsPage.unplacedSub),
      more: t.notifications.moreKinds,
    }),
    [t],
  )
}

/** One kind: held messages open their sheet in place; unplaced expenses go to Accounts, where their row sits. */
export function openPending(kind: PendingKind): void {
  if (kind === 'heldMessages') requestSmsReview()
  else navigate('/accounts')
}

/** Two or more kinds: the Inbox, Needs you. */
export function openNeedsYou(): void {
  navigate('/notifications?tab=needs-you')
}

export function usePending() {
  const entries = usePendingEntries()
  const labels = usePendingLabels()
  const copy = useMemo(() => pendingCopy(entries, labels), [entries, labels])
  return { entries, labels, copy }
}
