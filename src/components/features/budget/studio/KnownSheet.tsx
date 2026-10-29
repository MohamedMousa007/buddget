'use client'

import { ChevronRight } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { useBudgetStudioCopy } from '../useStudioCopy'

export interface KnownRow {
  id: string
  label: string
  value: string
}

export interface KnownSheetProps {
  open: boolean
  rows: KnownRow[]
  onPick: (id: string) => void
  onClose: () => void
}

/** Everything Buddgy currently knows for this plan, each row a way back to its question. */
export function KnownSheet({ open, rows, onPick, onClose }: KnownSheetProps) {
  const c = useBudgetStudioCopy().known
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      {open ? (
        <div className="flex flex-col gap-3 pt-1">
          <V3SheetHeader title={c.title} onClose={onClose} />
          <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.sub}</p>
          {rows.length === 0 ? <p className="text-sm text-[var(--color-brand-text-muted)]">{c.empty}</p> : null}
          <div className="flex flex-col">
            {rows.map((r) => (
              <Button
                key={r.id}
                variant="ghost"
                className="h-auto min-h-12 w-full justify-between gap-3 rounded-xl px-2 py-2 text-start"
                aria-label={`${c.change}: ${r.label}`}
                onClick={() => onPick(r.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-normal text-xs font-normal text-[var(--color-brand-text-secondary)]">{r.label}</span>
                  <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.value}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
