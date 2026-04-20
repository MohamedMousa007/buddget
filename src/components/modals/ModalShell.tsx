'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'

const OVERLAY_Z = 'z-[100]'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalShellProps {
  open: boolean
  onBackdropClick: () => void
  children: ReactNode
  /** Tailwind z-index classes for backdrop + panel (e.g. `z-[110]` for nested sheets). */
  zIndexClassName?: string
  /** Appended to the panel `className` (e.g. wider sheet). */
  panelClassName?: string
  /**
   * Bottom sheet: drag handle at top pulls down to dismiss; inner area scrolls independently (mobile-friendly).
   */
  dragToClose?: boolean
  /**
   * Fires once the open animation finishes (spring settles at y=0). Used by
   * onboarding's tutorial system to start the tutorial *after* the modal is
   * fully on-screen instead of during the spring animation. Called at most
   * once per open cycle; safe to omit outside onboarding.
   */
  onOpenAnimationComplete?: () => void
}

/**
 * Shared Framer Motion backdrop + sheet panel. Use for bottom/centered modals to avoid duplicating motion markup.
 */
export function ModalShell({
  open,
  onBackdropClick,
  children,
  zIndexClassName,
  panelClassName = '',
  dragToClose = false,
  onOpenAnimationComplete,
}: ModalShellProps) {
  const dragControls = useDragControls()
  const zStack = zIndexClassName ?? OVERLAY_Z
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const el = panelRef.current
    if (!el) return

    const focusPanel = () => {
      el.focus()
    }
    const id = requestAnimationFrame(focusPanel)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node.getClientRects().length > 0
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    el.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(id)
      el.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const panelStaticClasses =
    'fixed bottom-0 start-0 end-0 bg-[var(--color-brand-card)] rounded-t-3xl border-t border-[var(--color-brand-border)] max-h-[88vh] lg:bottom-auto lg:top-1/2 lg:start-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[440px] lg:rounded-2xl lg:border lg:max-h-[92vh]'

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
            className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm', zStack)}
          />
          <motion.div
            ref={panelRef}
            key="modal-panel"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onAnimationComplete={(definition) => {
              // Framer fires onAnimationComplete for both enter + exit. Only
              // signal the "open done" callback when the animated state is
              // the open target (`y: 0`). Dispatches both the direct
              // callback (prop-driven modals) and a `modal-opened` custom
              // event (so store-driven modals can be listened to by
              // anything — notably OnboardingModalGate — without threading
              // the prop through ModalProvider).
              if (
                typeof definition === 'object' &&
                definition !== null &&
                'y' in definition &&
                (definition as { y: number | string }).y === 0
              ) {
                onOpenAnimationComplete?.()
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('buddget:modal-opened'))
                }
              }
            }}
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
              zStack,
              dragToClose ? 'flex flex-col overflow-hidden outline-none' : 'overflow-y-auto outline-none',
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
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y px-5 pb-5">
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
