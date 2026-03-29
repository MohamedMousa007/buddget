'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'

const OVERLAY_Z = 'z-[100]'

interface ModalShellProps {
  open: boolean
  onBackdropClick: () => void
  children: ReactNode
  /** Appended to the panel `className` (e.g. wider sheet). */
  panelClassName?: string
  /**
   * Bottom sheet: drag handle at top pulls down to dismiss; inner area scrolls independently (mobile-friendly).
   */
  dragToClose?: boolean
}

/**
 * Shared Framer Motion backdrop + sheet panel. Use for bottom/centered modals to avoid duplicating motion markup.
 */
export function ModalShell({
  open,
  onBackdropClick,
  children,
  panelClassName = '',
  dragToClose = false,
}: ModalShellProps) {
  const dragControls = useDragControls()

  const panelStaticClasses =
    'fixed bottom-0 start-0 end-0 bg-[var(--color-brand-card)] rounded-t-3xl border-t border-[var(--color-brand-border)] max-h-[85vh] lg:bottom-auto lg:top-1/2 lg:start-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[480px] lg:rounded-2xl lg:border lg:max-h-[90vh]'

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
            className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm', OVERLAY_Z)}
          />
          <motion.div
            key="modal-panel"
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag={dragToClose ? 'y' : false}
            dragListener={false}
            dragControls={dragToClose ? dragControls : undefined}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (!dragToClose) return
              if (info.offset.y > 72 || info.velocity.y > 450) {
                onBackdropClick()
              }
            }}
            className={cn(
              panelStaticClasses,
              OVERLAY_Z,
              dragToClose ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
              panelClassName
            )}
          >
            {dragToClose ? (
              <>
                <div
                  className="flex shrink-0 justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
                  onPointerDown={(e) => dragControls.start(e)}
                  role="presentation"
                  aria-hidden
                >
                  <div className="w-10 h-1 rounded-full bg-[var(--color-brand-border)]" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y px-6 pb-6">
                  {children}
                </div>
              </>
            ) : (
              children
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
