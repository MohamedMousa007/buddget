'use client'

import { Pencil, Trash2 } from 'lucide-react'

type Props = {
  amountLine: string
  editLabel: string
  deleteLabel: string
  onEdit: () => void
  onDelete: () => void
}

export function IncomeSourceRowActions({ amountLine, editLabel, deleteLabel, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-sm font-mono-numbers text-[var(--color-brand-text-primary)]">{amountLine}</span>
      <button
        type="button"
        onClick={onEdit}
        className="p-1.5 rounded-lg hover:bg-[var(--color-brand-elevated)] opacity-70 group-hover:opacity-100"
        aria-label={editLabel}
      >
        <Pencil className="w-4 h-4 text-[var(--color-brand-text-muted)]" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 rounded-lg hover:bg-red-900/30 opacity-70 group-hover:opacity-100"
        aria-label={deleteLabel}
      >
        <Trash2 className="w-4 h-4 text-[var(--color-brand-red)]" aria-hidden />
      </button>
    </div>
  )
}
