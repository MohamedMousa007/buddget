'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useT } from '@/lib/i18n'

export interface IosInstallDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

/**
 * Step-by-step “Add to Home Screen” for iOS Safari (no `beforeinstallprompt` there).
 */
export function IosInstallDialog({ open, onOpenChange }: IosInstallDialogProps) {
  const t = useT()
  const steps = [
    { n: 1, text: t.pwa.iosStep1 },
    { n: 2, text: t.pwa.iosStep2 },
    { n: 3, text: t.pwa.iosStep3 },
    { n: 4, text: t.pwa.iosStep4 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-[var(--color-brand-card)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] ring-[var(--color-brand-text-primary)]/10"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--color-brand-text-primary)]">{t.pwa.iosDialogTitle}</DialogTitle>
          <DialogDescription className="text-[var(--color-brand-text-muted)]">
            {t.pwa.iosDialogDesc}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 mt-2">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex gap-3 text-sm text-[var(--color-brand-text-secondary)]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-elevated)] text-xs font-bold text-[var(--color-brand-red)]">
                {s.n}
              </span>
              <span className="pt-0.5 leading-snug">{s.text}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
