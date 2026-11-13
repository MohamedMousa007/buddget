'use client'

import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { usePendingSmsStore } from '@/lib/store/usePendingSmsStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useDetectedAccounts } from '@/hooks/useDetectedAccounts'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'
import { requestSmsReview } from '@/lib/sms/reviewRequest'
import { navigate } from '@/lib/navigation/navigate'
import { pendingCopy, pendingKinds, pendingSeverity, type PendingEntry, type PendingKind, type PendingLabels } from '@/lib/alerts/pendingSummary'

/** Teal = a review of something, amber = a balance is off until it is answered. */
export const PENDING_TONE: Record<PendingKind, 'teal' | 'amber'> = { heldMessages: 'teal', unplacedExpenses: 'amber', accountsFound: 'teal' }

/** What is waiting on the user right now: the one list the Flow row and the Inbox both read. */
export function usePendingEntries(): PendingEntry[] {
  const held = usePendingSmsStore((s) => s.held)
  const heldSince = usePendingSmsStore((s) => s.heldSince)
  // A string, so the selector result is stable until the count or the oldest date actually changes.
  const unplaced = useFinanceStore((s) => {
    const list = unplacedSmsExpenses(s.expenses)
    const oldest = list.reduce((min, e) => Math.min(min, Date.parse(e.date) || min), Infinity)
    return `${list.length}:${Number.isFinite(oldest) ? oldest : ''}`
  })
  // The same list the Accounts row and the sheet use, so the count can never disagree with either.
  const accounts = useDetectedAccounts().length
  return useMemo(() => {
    const [n, since] = unplaced.split(':')
    return pendingKinds([
      { kind: 'heldMessages', count: held, ...(heldSince != null ? { since: heldSince } : {}) },
      { kind: 'unplacedExpenses', count: Number(n), ...(since ? { since: Number(since) } : {}) },
      { kind: 'accountsFound', count: accounts },
    ])
  }, [held, heldSince, unplaced, accounts])
}

/** What the avatar dot shows: none, amber, or red after a week. The clock is re-read hourly, enough for a seven-day rule. */
export function usePendingSeverity(): 'none' | 'amber' | 'red' {
  const entries = usePendingEntries()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 3_600_000)
    return () => window.clearInterval(id)
  }, [])
  return pendingSeverity(entries, now)
}

export function usePendingLabels(): PendingLabels {
  const t = useT()
  return useMemo(
    () => ({
      mixedTitle: t.notifications.mixedTitle,
      label: (kind, count) =>
        kind === 'heldMessages' ? t.notifications.heldLabel(count) : kind === 'unplacedExpenses' ? t.notifications.unplacedLabel(count) : t.notifications.accountsLabel(count),
      hint: (kind) =>
        kind === 'heldMessages' ? t.notifications.heldHint : kind === 'unplacedExpenses' ? t.accountsPage.unplacedSub : t.notifications.accountsHint,
      more: t.notifications.moreKinds,
    }),
    [t],
  )
}

/** One kind: held messages open their sheet in place; found accounts open theirs on Accounts; unplaced expenses go to Accounts, where their row sits. */
export function openPending(kind: PendingKind): void {
  if (kind === 'heldMessages') requestSmsReview()
  else if (kind === 'accountsFound') {
    useSettingsStore.getState().setAccountsFoundOpen(true)
    navigate('/accounts')
  } else navigate('/accounts')
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
