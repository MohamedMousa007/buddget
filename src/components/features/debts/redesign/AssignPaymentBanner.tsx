'use client'

import { Link2 } from 'lucide-react'
import { fmtWhole } from './heroCardShared'

export interface AssignCandidate {
  id: string
  amount: number
  currency: string
  method: string
  date: string
}

/** Green assign-payment prompt for likely-but-unmatched installment payments (handoff §3c). */
export function AssignPaymentBanner({
  candidate,
  onAssign,
  onDismiss,
}: {
  candidate: AssignCandidate | null
  onAssign: (id: string) => void
  onDismiss: (id: string) => void
}) {
  if (!candidate) return null
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[#1DB954]/45 bg-[rgba(29,185,84,.08)] p-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(29,185,84,.18)] text-[#35D46F]">
        <Link2 className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-[var(--color-brand-text-primary)]">Assign a payment?</p>
        <p className="mt-0.5 truncate font-mono-numbers text-[13px] text-[var(--color-brand-text-muted)]">
          {fmtWhole(candidate.amount)} {candidate.currency} · {candidate.method} · {candidate.date} · likely a plan
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => onAssign(candidate.id)}
          className="h-9 rounded-[11px] bg-[var(--color-brand-green)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--color-brand-green-hover)]"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={() => onDismiss(candidate.id)}
          className="text-xs font-semibold text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
