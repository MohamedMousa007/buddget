'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
    'fixed bottom-0 start-0 end-0 bg-[var(--color-brand-card)] rounded-t-3xl border-t border-[var(--color-brand-border)] max-h-[90vh] lg:bottom-auto lg:top-1/2 lg:start-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[440px] lg:rounded-2xl lg:border lg:max-h-[90vh]'

  const [lgMotion, setLgMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setLgMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Keyboard avoidance for native + iOS Safari: when the soft keyboard rises,
  // shrink the panel so its content stays scrollable above the keyboard
  // instead of being clipped behind it.
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  useEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardOffset(inset)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [open])

  const desktopFadePanel = lgMotion

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onBackdropClick}
            className={cn('fixed inset-0', 'bg-black/60 backdrop-blur-sm', zStack)}
          />
          <motion.div
            ref={panelRef}
            key="modal-panel"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={desktopFadePanel ? { opacity: 0, scale: 0.98 } : { y: '100%' }}
            animate={desktopFadePanel ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={desktopFadePanel ? { opacity: 0, scale: 0.97 } : { y: '100%' }}
            transition={
              desktopFadePanel
                ? { duration: 0.22, ease: [0.32, 0.72, 0.34, 1] }
                : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
            }
            drag={dragToClose && !desktopFadePanel ? 'y' : false}
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
              'native-scroll',
              panelClassName
            )}
            style={
              keyboardOffset > 0 && !desktopFadePanel
                ? { paddingBottom: `${keyboardOffset}px` }
                : undefined
            }
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
