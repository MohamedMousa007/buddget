'use client'

import { Inbox, Landmark, MessageSquareText } from 'lucide-react'
import { PendingRow } from '@/components/ui/PendingRow'
import { PENDING_TONE, openNeedsYou, openPending, usePending } from '@/lib/alerts/usePending'

/**
 * Held bank messages are transactions the app has not counted yet, so they sit at the top of the ledger they belong to,
 * and only while they exist. One kind says what it is and opens its sheet; two or more say how many things need the
 * user, name them, and open the Inbox. A calm day renders nothing.
 */
export function FlowPendingRow() {
  const { copy } = usePending()
  if (!copy) return null
  if (copy.mode === 'single') {
    const { kind } = copy.entry
    return (
      <div className="mx-4 mt-3">
        <PendingRow
          tone={PENDING_TONE[kind]}
          icon={kind === 'heldMessages' ? MessageSquareText : Landmark}
          title={copy.title}
          subtitle={copy.subtitle}
          onPress={() => openPending(kind)}
        />
      </div>
    )
  }
  return (
    <div className="mx-4 mt-3">
      <PendingRow tone="amber" icon={Inbox} title={copy.title} subtitle={copy.subtitle} label={copy.spoken} onPress={openNeedsYou} />
    </div>
  )
}
