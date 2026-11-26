'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useActionToast } from '@/components/ui/ActionToast'
import { useSyncFailures } from '@/lib/store/useSyncFailures'
import { takeSyncNotice } from '@/lib/store/syncNoticeThrottle'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useHiddenStatus } from '@/hooks/useHiddenStatus'
import { StatusPill } from '@/components/ui/StatusPill'
import { useT } from '@/lib/i18n'

/**
 * Surfaces Supabase sync failures the user wouldn't otherwise notice — the sync layer
 * swallows per-table errors (FK constraints, RLS denials, network blips), and a row could
 * otherwise live forever in local state while the server never received it.
 *
 * A state, not a question, so it is the amber status pill. Retry is automatic (the sync
 * layer re-fires the same diff on every store change); the pill clears itself once the
 * failures do. Offline wins the slot: it explains the failures on its own.
 */
export function SyncFailureBanner() {
  const failures = useSyncFailures((s) => s.failures)
  const setAside = useSyncFailures((s) => s.setAside)
  const notice = useSyncFailures((s) => s.notice)
  const setNotice = useSyncFailures((s) => s.setNotice)
  const { online } = useNetworkStatus()
  const [hidden, hide] = useHiddenStatus('sync')
  const t = useT()

  const toast = useActionToast()
  const shownAt = useRef(new Map<string, number>())
  // A one-off notice (an undo or an edit that lost to another device) is a warning toast: it stacks with the other toasts
  // and clears itself, instead of a pill that stays until swiped away. Sync passes repeat it while the cause lasts, so a
  // repeat inside a minute is dropped: otherwise a new toast replaces the last one and it seems to stay for minutes.
  useEffect(() => {
    if (!notice) return
    if (takeSyncNotice(shownAt.current, notice, Date.now())) toast(t.syncFailures[notice], { tone: 'warning' })
    setNotice(null)
  }, [notice, setNotice, toast, t])

  if ((failures.length === 0 && setAside.length === 0) || !online) return null

  const label =
    failures.length === 0
      ? t.syncFailures.setAside(setAside.length)
      : failures.length === 1
        ? t.syncFailures.oneDidntSync
        : t.syncFailures.manyDidntSync(failures.length)

  return (
    <StatusPill
      icon={<AlertTriangle strokeWidth={2} />}
      label={label}
      visible={!hidden}
      onHide={hide}
    />
  )
}
