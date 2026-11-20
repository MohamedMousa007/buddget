'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { IconButton } from '@/components/ui/IconButton'
import type { BatchItem } from '@/lib/buddgy/tools/proposal'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { formatFixed2 } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { RecordPickers } from './RecordPickers'

function BatchRow({ item, onRemove, onRevise }: { item: BatchItem; onRemove: () => void; onRevise: (patch: Record<string, string>) => void }) {
  const copy = useBuddgyCardCopy()
  const p = item.proposal.preview
  const missing = p.missing?.includes('method') ?? false
  const [open, setOpen] = useState(missing)
  const name = p.what ?? p.title
  const value = (k: string) => p.rows.find((r) => r.key === k)?.value
  const sub = [value('category'), missing ? copy.payWith.label : value('method'), value('date')].filter(Boolean).join(' · ')
  const category = typeof item.proposal.args.category === 'string' ? item.proposal.args.category : ''
  return (
    <li className="border-b border-[var(--color-brand-border)] py-1">
      <div className="flex min-h-[52px] items-center gap-2.5">
        <span aria-hidden className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-elevated)]">
          <CategoryGlyph category={category} className="size-5" />
        </span>
        <button
          type="button"
          data-raw-button-ok="the name of a batch row, tappable as a whole to open its pickers"
          aria-label={copy.batch.edit(name)}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-start outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]"
        >
          <span dir="auto" className="truncate font-semibold">{name}</span>
          <span dir="auto" className={cn('truncate text-xs', missing ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-muted)]')}>{sub}</span>
        </button>
        {p.amount !== undefined ? <span className="font-mono-numbers shrink-0 text-sm font-semibold tabular-nums">{formatFixed2(p.amount)}</span> : null}
        <IconButton aria-label={copy.batch.remove(name)} variant="ghost" size="md" onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </div>
      {open ? (
        <div className="pb-2.5 ps-12">
          <RecordPickers preview={p} onRevise={onRevise} payLabel={copy.batch.payFor(name)} />
        </div>
      ) : null}
    </li>
  )
}

/** Several quick adds: one row each, a trash button to drop a row, a row's pickers open in place. */
export function BatchBody({ items, onRemoveRow, onRevise }: { items: BatchItem[]; onRemoveRow: (key: string) => void; onRevise: (patch: Record<string, string>, rowKey: string) => void }) {
  const copy = useBuddgyCardCopy().batch
  if (items.length === 0) return <p className="text-[var(--color-brand-text-secondary)]">{copy.nothing}</p>
  return (
    <ul aria-label={copy.list} className="-mt-1.5 flex flex-col">
      {items.map((it) => (
        <BatchRow key={it.key} item={it} onRemove={() => onRemoveRow(it.key)} onRevise={(patch) => onRevise(patch, it.key)} />
      ))}
    </ul>
  )
}
