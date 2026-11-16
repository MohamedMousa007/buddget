'use client'

import { Link2 } from 'lucide-react'
import { fmtWhole } from './heroCardShared'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { useT } from '@/lib/i18n'

export interface AssignCandidate {
  id: string
  amount: number
  currency: string
  method: string
  date: string
  debtId?: string
}

/** Assign-payment prompt for likely-but-unmatched installment payments (handoff §3c), on the shared inline banner. */
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
    <PromptBanner
      icon={<Link2 aria-hidden />}
      title={t.assignTitle}
      description={<span className="font-mono-numbers">{t.assignSub(`${fmtWhole(candidate.amount)} ${candidate.currency}`, candidate.method, candidate.date)}</span>}
      confirmLabel={t.assignBtn}
      onConfirm={() => onAssign(candidate)}
      dismissLabel={t.notNow}
      onDismiss={() => onDismiss(candidate.id)}
    />
  )
}
