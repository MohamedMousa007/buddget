'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'
import { useT } from '@/lib/i18n'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'

/**
 * PWA “new build available” prompt — glass, dark-first, bottom-center.
 */
export function UpdateToast() {
  const { updateAvailable, applyUpdate, dismiss } = usePwaUpdate()
  const t = useT()

  return (
    <div
      data-inert-exempt
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex justify-center px-4 pb-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {updateAvailable ? (
          <motion.div
            key="pwa-update"
            initial={{ y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto w-full max-w-md"
          >
            <div className="relative flex flex-col gap-3 rounded-2xl border border-[var(--color-brand-text-primary)]/[0.08] bg-[var(--color-brand-card)]/70 px-4 py-3.5 shadow-[var(--shadow-lg)] backdrop-blur-xl ring-1 ring-[var(--color-brand-primary)]/20 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <IconButton
                onClick={dismiss}
                aria-label={t.a11y.dismissUpdate}
                size="sm"
                className="absolute end-2 top-2 shrink-0 sm:end-3 sm:top-3"
              >
                <X className="h-4 w-4" aria-hidden />
              </IconButton>
              <div className="flex min-w-0 items-start gap-3 pe-8 sm:pe-0">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)] shadow-inner">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm leading-snug text-[var(--color-brand-text-secondary)]">
                  <span className="font-medium text-[var(--color-brand-text-primary)]">{t.pwa.updateTitle}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-brand-text-muted)]">
                    {t.pwa.updateSubtitle}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                <Button onClick={dismiss} variant="outline" size="touch">
                  {t.pwa.updateNotNow}
                </Button>
                <Button onClick={applyUpdate} size="touch" className="shadow-[var(--shadow-md)]">
                  {t.pwa.updateRefresh}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
