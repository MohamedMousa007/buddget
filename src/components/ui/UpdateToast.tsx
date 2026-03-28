'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'

/**
 * PWA “new build available” prompt — glass, dark-first, bottom-center.
 */
export function UpdateToast() {
  const { updateAvailable, applyUpdate, dismiss } = usePwaUpdate()

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      aria-hidden={!updateAvailable}
    >
      <AnimatePresence>
        {updateAvailable ? (
          <motion.div
            key="pwa-update"
            role="status"
            aria-live="polite"
            initial={{ y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto w-full max-w-md"
          >
            <div className="relative flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[var(--color-brand-card)]/70 px-4 py-3.5 shadow-lg shadow-blue-500/20 backdrop-blur-xl ring-1 ring-blue-500/20 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <button
                type="button"
                onClick={dismiss}
                className="absolute right-2 top-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-brand-text-muted)] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 sm:right-3 sm:top-3"
                aria-label="Dismiss update notice"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex min-w-0 items-start gap-3 pr-8 sm:pr-0">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 shadow-inner shadow-blue-500/10">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm leading-snug text-[var(--color-brand-text-secondary)]">
                  <span className="font-medium text-white">A new version of budget.ai is ready.</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-brand-text-muted)]">
                    Refresh to load the latest experience.
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[var(--color-brand-text-secondary)] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-900/30 transition-colors hover:bg-[var(--color-brand-red-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                >
                  Refresh Now
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
