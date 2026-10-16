'use client'

import { useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { SetupChecklist } from '@/components/features/setup/SetupChecklist'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useT } from '@/lib/i18n'

/** Header ring + % while setup is unfinished (after the first transaction); opens the checklist sheet. */
export function SetupProgressChip() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { pct, hasTransaction } = useSetupProgress()
  if (!hasTransaction || pct >= 100) return null

  return (
    <>
      <IconButton variant="ghost" size="sm" shape="round" onClick={() => setOpen(true)} aria-label={t.setup.chipAria(pct)}>
        <ProgressRing pct={pct} size={32} stroke={3}>
          <span className="font-mono-numbers text-[10px] font-semibold text-[var(--color-brand-text-primary)]">{pct}</span>
        </ProgressRing>
      </IconButton>
      <ModalShell open={open} onBackdropClick={() => setOpen(false)} padContent>
        <ModalSheetHeader title={t.setup.title} onClose={() => setOpen(false)} />
        <SetupChecklist onNavigate={() => setOpen(false)} className="border-0 p-0" />
      </ModalShell>
    </>
  )
}
