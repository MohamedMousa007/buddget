'use client'

import { MessageSquare, CloudOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { usePendingSmsPreviews } from '@/hooks/usePendingSmsPreviews'

const MAX_VISIBLE = 3

/**
 * "Waiting to sync" cards for SMS captured while offline. Curated-pattern
 * matches show the real amount/merchant (parsed locally); AI-tier messages
 * show a generic card. Purely informational — the server still creates the
 * actual transaction on drain, at which point these disappear.
 */
export function PendingSmsCards() {
  const t = useT()
  const previews = usePendingSmsPreviews()

  if (previews.length === 0) return null

  const visible = previews.slice(0, MAX_VISIBLE)
  const overflow = previews.length - visible.length

  return (
    <div className="mx-4 mt-3 flex flex-col gap-2">
      {visible.map((p) => (
        <div
          key={p.key}
          className="flex min-h-11 items-center gap-3 rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-2.5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            {p.parsed ? <MessageSquare className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-[var(--color-brand-text-primary)]">
              {p.parsed ? (p.parsed.counterparty || p.parsed.bank) : t.pendingSms.generic}
            </span>
            <span className="block text-xs text-amber-400">{t.pendingSms.waiting}</span>
          </span>
          {p.parsed && (
            <span className="shrink-0 text-sm font-semibold text-[var(--color-brand-text-primary)] [font-variant-numeric:tabular-nums]">
              {p.parsed.amount.toLocaleString()} {p.parsed.currency}
            </span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <p className="px-1 text-xs text-[var(--color-brand-text-muted)]">
          {t.pendingSms.more(overflow)}
        </p>
      )}
    </div>
  )
}
