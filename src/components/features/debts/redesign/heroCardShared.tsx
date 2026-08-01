'use client'

import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'

/** Whole-number formatter used across debt hero cards (no cents, grouped). */
export function fmtWhole(n: number): string {
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
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
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
        aria-label={label}
        className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      <CardActionMenu
        anchor={anchor}
        onClose={() => setAnchor(null)}
        items={[
          { label: 'Edit', icon: <Pencil size={17} />, onSelect: onClick },
          ...(onDelete ? [{
            label: deleteLabel ?? 'Delete', icon: <Trash2 size={17} />, destructive: true,
            onSelect: async () => { if (await confirm({ title: deleteLabel ?? 'Delete?', body: deleteBody ?? 'This cannot be undone.', destructive: true })) onDelete() },
          }] : []),
        ]}
      />
    </>
  )
}
