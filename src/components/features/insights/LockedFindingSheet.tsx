'use client'

import { Sparkles } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useT } from '@/lib/i18n'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'

/** What the sheet was opened from: a finding (its sentence with the figures hidden), or nothing for a section or "See Pro". */
export interface LockedFinding {
  tag?: string
  headline?: string
}

interface Props {
  /** Null when closed. */
  finding: LockedFinding | null
  onSeePro: () => void
  onClose: () => void
}

/** What a locked finding is, in its own words, before any paywall: the sentence stays, the figures do not. */
export function LockedFindingSheet({ finding, onSeePro, onClose }: Props) {
  const c = useT().insights.lockSheet
  const lt = useInsightsLtCopy().lockSheet
  return (
    <ModalShell open={finding !== null} onBackdropClick={onClose} zIndexClassName="z-[120]" panelClassName="md:w-[420px]" padContent>
      <div className="flex flex-col gap-4 pb-1">
        <span className="mx-auto mt-1 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(112deg,var(--member-gilt-lo),var(--member-gilt-hi)_45%,var(--member-gilt-mid))] text-[var(--member-on-gilt)]">
          <Sparkles aria-hidden className="size-7" />
        </span>
        <div className="text-center">
          <V3SheetHeader.DialogTitle>{c.title}</V3SheetHeader.DialogTitle>
          {finding?.headline ? <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)]">{finding.headline}</p> : null}
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-[var(--color-brand-text-primary)]">{lt.body}</p>
          <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{lt.free}</p>
        </div>
        <div className="grid gap-1">
          <Button size="cta-block" onClick={onSeePro}>{c.cta}</Button>
          <Button size="touch" variant="ghost" className="text-[var(--color-brand-text-secondary)]" onClick={onClose}>{c.later}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
