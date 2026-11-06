'use client'

import { Link2 } from 'lucide-react'
import { fmtWhole, soft } from './heroCardShared'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

export interface AssignCandidate {
  id: string
  amount: number
  currency: string
  method: string
  date: string
  debtId?: string
}

/** Assign-payment prompt for likely-but-unmatched installment payments (handoff §3c). */
export function AssignPaymentBanner({
  candidate,
  onAssign,
  onDismiss,
}: {
  candidate: AssignCandidate | null
  onAssign: (candidate: AssignCandidate) => void
  onDismiss: (id: string) => void
}) {
  const t = useT().debts
  if (!candidate) return null
  return (
    <div
      className="flex items-center gap-3 rounded-[16px] border p-3.5"
      style={{ borderColor: soft('var(--color-brand-green)', 45), background: 'var(--color-brand-green-soft)' }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[var(--color-brand-green)]"
        style={{ background: soft('var(--color-brand-green)', 18) }}
      >
        <Link2 className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{t.assignTitle}</p>
        <p className="mt-0.5 truncate font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
          {t.assignSub(`${fmtWhole(candidate.amount)} ${candidate.currency}`, candidate.method, candidate.date)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <Button variant="success" size="touch" onClick={() => onAssign(candidate)} className="font-bold">
          {t.assignBtn}
        </Button>
        <Button
          onClick={() => onDismiss(candidate.id)}
          variant="ghost"
          size="touch"
          className="text-[var(--color-brand-text-muted)]"
        >
          {t.notNow}
        </Button>
      </div>
    </div>
  )
}
