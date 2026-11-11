'use client'

import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { IconButton } from '@/components/ui/IconButton'
import { Card } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Whole-number formatter used across debt hero cards (no cents, grouped). */
export function fmtWhole(n: number): string {
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** A translucent tint of any CSS colour (token or data-driven hex). */
export function soft(color: string, pct = 16): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`
}

export { readable } from '@/lib/utils/color'

/** The shared debt-card surface: ui Card + the kebab slot. Children own their own layout. */
export function DebtCardFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card elevation="sm" className={cn('relative flex flex-col', className)}>
      {children}
    </Card>
  )
}

/** Token bar on the elevated track; `tone` is any CSS colour. */
export function DebtBar({ pct, tone, label, className }: { pct: number; tone: string; label: string; className?: string }) {
  return (
    <Progress value={Math.max(0, Math.min(100, pct))} aria-label={label} className={className}>
      <ProgressTrack className="h-1.5 bg-[var(--color-brand-elevated)]">
        <ProgressIndicator className="rounded-full" style={{ background: tone }} />
      </ProgressTrack>
    </Progress>
  )
}

/**
 * Top-right ⋮ menu shared by every hero card. Design-system rule: cards expose a kebab (Edit +
 * Delete), never a bare pen icon or an inline Delete CTA. `onDelete` is optional — Edit-only cards
 * just omit it. Delete is guarded by the styled confirm dialog.
 */
export function EditPin({
  onClick, onDelete, label, deleteLabel, deleteBody,
}: {
  onClick: () => void
  onDelete?: () => void
  label: string
  deleteLabel?: string
  deleteBody?: string
}) {
  const confirm = useConfirm()
  const t = useT()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  return (
    <>
      <IconButton
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={label}
        variant="tinted"
        size="sm"
        shape="round"
        className="absolute end-3 top-3"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </IconButton>
      <CardActionMenu
        anchor={anchor}
        onClose={() => setAnchor(null)}
        items={[
          { label: t.debts.actionEdit, icon: <Pencil size={17} />, onSelect: onClick },
          ...(onDelete ? [{
            label: deleteLabel ?? t.common.delete, icon: <Trash2 size={17} />, destructive: true,
            onSelect: async () => { if (await confirm({ title: deleteLabel ?? t.debts.deleteConfirmTitle, body: deleteBody ?? t.debts.deleteConfirmBody, destructive: true })) onDelete() },
          }] : []),
        ]}
      />
    </>
  )
}
