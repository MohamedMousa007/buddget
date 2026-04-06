'use client'

import { useState } from 'react'
import type { ServerNotificationRow } from '@/lib/notifications/useNotifications'

export interface BudgetInviteCardProps {
  row: ServerNotificationRow
  labels: {
    preview: string
    accept: string
    decline: string
    working: string
  }
  onPreview: (planId: string) => void
  onResolved: () => void
}

/**
 * Accept / decline actions for a `budget_invite` server notification.
 */
export function BudgetInviteCard({
  row,
  labels,
  onPreview,
  onResolved,
}: BudgetInviteCardProps) {
  const [busy, setBusy] = useState(false)
  const meta = row.metadata ?? {}
  const planId = typeof meta.plan_id === 'string' ? meta.plan_id : ''
  const memberId = typeof meta.member_id === 'string' ? meta.member_id : ''

  async function patch(action: 'accept' | 'decline') {
    if (!memberId) return
    setBusy(true)
    try {
      const res = await fetch('/api/budget/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action }),
      })
      if (res.ok) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [row.id] }),
        })
        onResolved()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/80 p-3 space-y-2">
      <p className="text-sm font-medium text-white">{row.title}</p>
      {row.body ? <p className="text-xs text-[var(--color-brand-text-muted)]">{row.body}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {planId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onPreview(planId)}
            className="cursor-pointer rounded-lg border border-[var(--color-brand-border)] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-brand-card)] disabled:opacity-50"
          >
            {labels.preview}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !memberId}
          onClick={() => void patch('accept')}
          className="cursor-pointer rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? labels.working : labels.accept}
        </button>
        <button
          type="button"
          disabled={busy || !memberId}
          onClick={() => void patch('decline')}
          className="cursor-pointer rounded-lg border border-[var(--color-brand-border)] px-2.5 py-1.5 text-xs text-[var(--color-brand-text-muted)] hover:text-white disabled:opacity-50"
        >
          {labels.decline}
        </button>
      </div>
    </div>
  )
}
