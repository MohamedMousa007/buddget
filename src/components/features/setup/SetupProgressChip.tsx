'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { SetupChecklist } from '@/components/features/setup/SetupChecklist'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useT } from '@/lib/i18n'

/** "Finish setup · 50%" pill while setup is unfinished (after the first transaction); opens the checklist sheet. */
export function SetupProgressChip() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { pct, hasTransaction } = useSetupProgress()
  if (!hasTransaction || pct >= 100) return null

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={t.setup.chipAria(pct)}
        className="relative h-8 shrink-0 gap-1 rounded-full border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary-soft)] px-3 text-xs font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]/70 hover:text-[var(--color-brand-primary-ink)] after:absolute after:left-1/2 after:top-1/2 after:min-h-[44px] after:min-w-[44px] after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
      >
        <span className="max-[359px]:hidden">{t.setup.chipLabel} ·</span>
        <span className="font-mono-numbers">{pct}%</span>
      </Button>
      <ModalShell open={open} onBackdropClick={() => setOpen(false)} padContent>
        <ModalSheetHeader title={t.setup.title} onClose={() => setOpen(false)} />
        <SetupChecklist onNavigate={() => setOpen(false)} className="border-0 p-0" />
      </ModalShell>
    </>
  )
}
