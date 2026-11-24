'use client'

import { Lock } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useT } from '@/lib/i18n'

interface Props {
  /** The finding's tag and sentence with its figures already hidden, or null when closed. */
  finding: { tag: string; headline: string } | null
  onSeePro: () => void
  onClose: () => void
}

/** What a locked finding is, in its own words, before any paywall: the sentence stays, the figures do not. */
export function LockedFindingSheet({ finding, onSeePro, onClose }: Props) {
  const c = useT().insights.lockSheet
  return (
    <ModalShell open={finding !== null} onBackdropClick={onClose} zIndexClassName="z-[120]" panelClassName="md:w-[420px]" padContent>
      <div className="flex flex-col gap-4 pb-1">
        <span className="mx-auto mt-1 flex size-12 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-brand-gold)_16%,var(--color-brand-card))] text-[var(--color-brand-gold)]">
          <Lock aria-hidden className="size-5" />
        </span>
        <div className="text-center">
          <V3SheetHeader.DialogTitle>{c.title}</V3SheetHeader.DialogTitle>
          {finding ? <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)]">{finding.headline}</p> : null}
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-brand-text-muted)]">{c.body}</p>
        </div>
        <div className="grid gap-2.5">
          <Button size="cta" onClick={onSeePro}>{c.cta}</Button>
          <Button size="cta" variant="outline" onClick={onClose}>{c.later}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
