'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export interface UpdateToastProps {
  onRefresh: () => void
}

/**
 * PWA “new build available” prompt — glass, dark-first, bottom-center (positioned by parent).
 */
export function UpdateToast({ onRefresh }: UpdateToastProps) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ y: 56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 48, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="pointer-events-auto w-full max-w-md px-4"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[var(--color-brand-card)]/70 px-4 py-3.5 shadow-lg shadow-blue-500/20 backdrop-blur-xl ring-1 ring-blue-500/20 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
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
        <button
          type="button"
          onClick={onRefresh}
          className="shrink-0 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-900/30 transition-colors hover:bg-[var(--color-brand-red-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
        >
          Refresh Now
        </button>
      </div>
    </motion.div>
  )
}
