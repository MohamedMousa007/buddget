'use client'

import { Bell, Landmark, MessageSquareText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PendingRow } from '@/components/ui/PendingRow'
import { useT } from '@/lib/i18n'
import { PENDING_TONE, openPending, usePending } from '@/lib/alerts/usePending'

/** The Inbox's "Needs you" tab: every kind that waits on the user as its own row, each opening what resolves it. */
export function NeedsYouList() {
  const t = useT()
  const { entries, labels } = usePending()
  if (entries.length === 0) {
    return (
      <Card padding="none" className="py-14 text-center">
        <Bell className="mx-auto h-7 w-7 text-[var(--color-brand-text-muted)]" />
        <p className="mt-3 text-sm text-[var(--color-brand-text-secondary)]">{t.notifications.needsYouEmpty}</p>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {entries.map(({ kind, count }) => (
        <PendingRow
          key={kind}
          tone={PENDING_TONE[kind]}
          icon={kind === 'heldMessages' ? MessageSquareText : Landmark}
          title={labels.label(kind, count)}
          subtitle={labels.hint(kind)}
          onPress={() => openPending(kind)}
        />
      ))}
    </div>
  )
}
