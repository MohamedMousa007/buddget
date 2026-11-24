'use client'

import { MessageCircle, MessagesSquare, Plus } from 'lucide-react'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import type { UserFacingStatus } from '@/lib/support/conversation'
import { useSupportCopy } from '@/lib/support/supportCopy'
import type { ConversationRow } from './types'

export const STATUS_TONE: Record<UserFacingStatus, 'brand' | 'warn' | 'positive' | 'neutral'> = {
  open: 'brand',
  waiting: 'warn',
  resolved: 'positive',
  closed: 'neutral',
}

/** The user's conversations, latest first: status, last line, when, and a dot for an unread reply. */
export function SupportConversationList({ rows, onOpen, onNew }: { rows: ConversationRow[] | null; onOpen: (n: number) => void; onNew: () => void }) {
  const copy = useSupportCopy()
  const fmt = useLocalizedFormatters()

  if (rows === null) return <div className="px-5"><SkeletonList rows={3} /></div>

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare className="size-6" aria-hidden />}
        title={copy.empty}
        description={copy.emptyHint}
        action={<Button size="cta-block" onClick={onNew}><Plus />{copy.newMessage}</Button>}
      />
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <Button size="touch" className="w-full" onClick={onNew}><Plus />{copy.newMessage}</Button>
      <ul className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
        {rows.map((r) => {
          const who = r.last_message_from === 'staff' ? copy.team : r.last_message_from === 'user' ? copy.you : null
          const preview = r.last_message_preview ? `${who ? `${who}: ` : ''}${r.last_message_preview.slice(0, 90)}` : undefined
          return (
            <li key={r.number}>
              <SettingsRow
                icon={MessageCircle}
                tone={r.unread ? 1 : 'neutral'}
                title={r.subject}
                subtitle={preview}
                onClick={() => onOpen(r.number)}
                trailing={
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{fmt.formatRelativeTime(r.last_message_at ?? r.created_at)}</span>
                      {r.unread ? <span className="size-2 rounded-full bg-[var(--color-brand-primary)]" role="img" aria-label={copy.unread} /> : null}
                    </span>
                    <Badge tone={STATUS_TONE[r.display_status]} size="xs" bordered={false}>{copy.status[r.display_status]}</Badge>
                  </span>
                }
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
