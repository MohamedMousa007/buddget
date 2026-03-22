'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const panelBaseClass =
  'fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-brand-card)] rounded-t-3xl border-t border-[var(--color-brand-border)] max-h-[85vh] overflow-y-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[480px] lg:rounded-2xl lg:border lg:max-h-[90vh]'

interface ModalShellProps {
  open: boolean
  onBackdropClick: () => void
  children: ReactNode
  /** Appended to the panel `className` (e.g. wider sheet). */
  panelClassName?: string
}

/**
 * Shared Framer Motion backdrop + sheet panel. Use for bottom/centered modals to avoid duplicating motion markup.
 */
export function ModalShell({ open, onBackdropClick, children, panelClassName = '' }: ModalShellProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onBackdropClick}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="modal-panel"
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(panelBaseClass, panelClassName)}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
