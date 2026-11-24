'use client'

import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useSupportUnread } from '@/lib/support/openThread'
import { useSupportCopy } from '@/lib/support/supportCopy'

/** The end of a row that leads to Help: the unread-reply count when there is one, then the usual chevron. */
export function SupportUnreadTrailing() {
  const unread = useSupportUnread()
  const copy = useSupportCopy()
  return (
    <span className="flex shrink-0 items-center gap-2">
      {unread ? <Badge tone="brand" size="sm" bordered={false} className="font-mono-numbers" aria-label={copy.unreadHint(unread)}>{unread}</Badge> : null}
      <ChevronRight className="size-4 shrink-0 rtl:rotate-180 text-[var(--color-brand-text-muted)]" aria-hidden />
    </span>
  )
}
