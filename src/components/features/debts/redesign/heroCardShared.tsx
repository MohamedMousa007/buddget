'use client'

import { Pencil } from 'lucide-react'

/** Whole-number formatter used across debt hero cards (no cents, grouped). */
export function fmtWhole(n: number): string {
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** Top-right round edit-pin shared by every hero card (handoff §3). */
export function EditPin({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}
