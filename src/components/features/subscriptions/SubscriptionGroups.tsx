'use client'

import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import type { RowGroup, RowModel } from '@/lib/subscriptions/subscriptionRows'
import { money2 } from '@/lib/subscriptions/subscriptionFormat'
import { SubscriptionRow } from './SubscriptionRow'

const LABEL = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]'

function RowCard({ rows, onOpen }: { rows: RowModel[]; onOpen: (id: string) => void }) {
  return (
    <Card padding="none" radius="sm" className="divide-y divide-[var(--color-brand-border)] overflow-hidden">
      {rows.map((r) => (
        <SubscriptionRow key={r.sub.id} row={r} onOpen={() => onOpen(r.sub.id)} />
      ))}
    </Card>
  )
}

/** Timeline groups, then Paused and Cancelled collapsed into one card that expands in place. */
export function SubscriptionGroups({
  groups,
  paused,
  cancelled,
  onOpen,
}: {
  groups: RowGroup[]
  paused: RowModel[]
  cancelled: RowModel[]
  onOpen: (id: string) => void
}) {
  const t = useT()
  const ui = t.subscriptions.ui
  const [open, setOpen] = useState<'paused' | 'cancelled' | null>(null)
  const collapsed = [
    { key: 'paused' as const, label: t.subscriptions.paused, rows: paused },
    { key: 'cancelled' as const, label: t.subscriptions.cancelled, rows: cancelled },
  ].filter((c) => c.rows.length > 0)

  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className={LABEL}>{ui.groups[g.key]}</h2>
            {g.total > 0 ? (
              <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{money2(g.total)}</span>
            ) : null}
          </div>
          <RowCard rows={g.rows} onOpen={onOpen} />
        </section>
      ))}
      {collapsed.length > 0 ? (
        <Card padding="none" radius="sm" className="divide-y divide-[var(--color-brand-border)] overflow-hidden">
          {collapsed.map((c) => (
            <div key={c.key}>
              <button
                type="button"
                aria-expanded={open === c.key}
                onClick={() => setOpen(open === c.key ? null : c.key)}
                data-raw-button-ok="a disclosure row: label, count and chevron as one target"
                className="flex min-h-12 w-full items-center gap-2.5 px-3.5 text-start text-sm font-medium text-[var(--color-brand-text-primary)]"
              >
                <span className="flex-1">{c.label}</span>
                <span className="font-mono-numbers text-[var(--color-brand-text-secondary)]">{c.rows.length}</span>
                <ChevronRight
                  className={`size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180 ${open === c.key ? 'rotate-90 rtl:rotate-90' : ''}`}
                  aria-hidden
                />
              </button>
              {open === c.key ? (
                <div className="divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">
                  {c.rows.map((r) => (
                    <SubscriptionRow key={r.sub.id} row={r} onOpen={() => onOpen(r.sub.id)} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      ) : null}
    </>
  )
}
