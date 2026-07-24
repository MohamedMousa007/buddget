'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNumpadInset } from '@/lib/ui/numpadInset'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { useEscapeClose } from '@/hooks/useEscapeClose'

const OVERLAY_Z = 'z-[100]'

// Ghost-click guard: the tap that opens a modal fires its compatibility `click`
// after React has already mounted the full-screen backdrop, so the click lands
// on the backdrop and instantly closes the modal (BUD-50 FAB flicker). Ignore
// dismissal events landing within this window of the modal opening.
const OPEN_GRACE_MS = 400

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Input types that raise a soft keyboard (or a bottom-anchored picker) on mobile. */
const TEXT_ENTRY_TYPES = new Set([
  'text', 'email', 'password', 'search', 'tel', 'url', 'number',
  'date', 'time', 'datetime-local', 'month', 'week',
])

/**
 * Whether this element is one the soft keyboard opens for.
 *
 * The focused element — not the viewport — is the cross-platform keyboard signal.
 * `visualViewport` shrinks on iOS and desktop web, but on Android the WebView itself is
 * resized, so the visual viewport matches the layout viewport and reports no inset at all.
 */
function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  const input = el as HTMLInputElement
  return !input.readOnly && !input.disabled && TEXT_ENTRY_TYPES.has(input.type)
}

interface ModalShellProps {
  open: boolean
  onBackdropClick: () => void
  children: ReactNode
  /** Tailwind z-index classes for backdrop + panel (e.g. `z-[110]` for nested sheets). */
  zIndexClassName?: string
  /** Appended to the panel `className` (e.g. wider sheet). */
  panelClassName?: string
  /**
   * Bottom sheet: drag handle at top pulls down to dismiss; inner area scrolls
   * independently (mobile-friendly). On by default — every bottom sheet is
   * swipe-closable. Automatically disabled on desktop (centered fade).
   */
  dragToClose?: boolean
  /**
   * Adds the sheet's inner horizontal + bottom padding (`px-5 pb-5`). Set for
   * sheets whose content does NOT bring its own padding; leave off for forms
   * that already pad themselves so they aren't double-inset.
   */
  padContent?: boolean
  /**
   * The child manages its own scroll (pinned header + internal scrolling body,
   * e.g. ExpenseSheetForm). ModalShell then renders the child as a bounded flex
   * column WITHOUT its own scroll container, so there's no nested scroller.
   */
  scrollChild?: boolean
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
  dragToClose = true,
  padContent = false,
  scrollChild = false,
}: ModalShellProps) {
  const dragControls = useDragControls()
  const zStack = zIndexClassName ?? OVERLAY_Z
  const panelRef = useRef<HTMLDivElement>(null)

  // Lock the background scroll while open so a touch-drag on the backdrop /
  // non-scrolling chrome can't scroll the page behind the sheet.
  useScrollLock(open)

  const openedAtRef = useRef(0)
  useEffect(() => {
    if (open) openedAtRef.current = performance.now()
  }, [open])
  const guardedDismiss = () => {
    if (performance.now() - openedAtRef.current < OPEN_GRACE_MS) return
    onBackdropClick()
  }

  // Android hardware-back: the topmost open sheet consumes the press and closes
  // itself (LIFO), so back steps out one layer at a time instead of dismissing a
  // whole modal stack at once. Registered once per open using a ref for the cb.
  const onBackRef = useRef(onBackdropClick)
  useEffect(() => { onBackRef.current = onBackdropClick })
  useEffect(() => {
    if (!open) return
    return registerBackGuard(() => { onBackRef.current(); return true })
  }, [open])

  // Keyboard Escape shares the same LIFO stack as Android back, so both dismiss
  // only the topmost layer — a nested sheet no longer closes the parent behind it.
  useEscapeClose(open, () => onBackRef.current())

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

  // Tracks whether a field the keyboard opens for currently holds focus. Deferred a frame
  // because `focusout` lands before the next `focusin`, and reading `document.activeElement`
  // in between sees <body> — moving between two inputs would flash the footer back in.
  const [textEntryFocused, setTextEntryFocused] = useState(false)
  useEffect(() => {
    let raf = 0
    const check = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setTextEntryFocused(open && isTextEntry(document.activeElement)))
    }
    check()
    if (!open) return () => cancelAnimationFrame(raf)
    document.addEventListener('focusin', check)
    document.addEventListener('focusout', check)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('focusin', check)
      document.removeEventListener('focusout', check)
    }
  }, [open])

  const desktopFadePanel = lgMotion

  // Lift the panel above the OS keyboard OR the glass NumberPad (same code path).
  const numpadInset = useNumpadInset()
  const bottomInset = Math.max(keyboardOffset, numpadInset)

  // Published to CSS so pinned sheet footers (`.sheet-cta`) drop out of the layout while the
  // keyboard is up: a submit button is pressed once the fields are done, so floating it above
  // the keyboard only steals rows of screen from the fields still being filled in.
  // Desktop keeps the footer — there is no keyboard eating the viewport there.
  const keyboardUp = !desktopFadePanel && (bottomInset > 0 || textEntryFocused)

  // Portal to <body> so the sheet's `position: fixed` always resolves against
  // the viewport — a CSS transform on any ancestor (a parent framer-drag panel,
  // an `-translate-y` wrapper) would otherwise trap it in that ancestor's box
  // and stacking context (the payment-preview overlap + narrow currency sheet).
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={guardedDismiss}
            className={cn('fixed inset-0', 'bg-black/60 backdrop-blur-sm', zStack)}
          />
          <motion.div
            ref={panelRef}
            key="modal-panel"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            data-keyboard-open={keyboardUp ? 'true' : undefined}
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
                guardedDismiss()
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
              bottomInset > 0 && !desktopFadePanel
                ? { paddingBottom: `${bottomInset}px` }
                : undefined
            }
          >
            {dragToClose ? (
              <>
                {/* Generous, misclick-safe grab strip (≥44px). Sole drag
                    initiator: it sits above all interactive content, so it can
                    never swallow a tap on a button/input. Hidden on desktop,
                    where the sheet is a centered fade with no drag. */}
                <div
                  className="flex shrink-0 items-center justify-center min-h-11 cursor-grab active:cursor-grabbing touch-none select-none lg:hidden"
                  onPointerDown={(e) => dragControls.start(e)}
                  role="presentation"
                  aria-hidden
                >
                  <div className="w-10 h-1 rounded-full bg-[var(--color-brand-border)]" />
                </div>
                <div
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    !scrollChild && 'overflow-y-auto overscroll-y-contain touch-pan-y',
                    padContent && 'px-5 pb-5',
                  )}
                >
                  {children}
                </div>
              </>
            ) : (
              children
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
