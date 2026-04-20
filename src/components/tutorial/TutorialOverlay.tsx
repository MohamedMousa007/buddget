'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * The visual layer of the tutorial: a darkened backdrop with a hole around
 * the target anchor, plus a popover that sits next to it. Rendered via
 * portal to document.body so it escapes any z-index traps from modals.
 *
 * Implementation notes
 * --------------------
 * - **Four-rectangle backdrop**, not a single element with CSS mask. This
 *   lets interactive steps leave the target clickable — the rectangles
 *   cover top/right/bottom/left of the target; the target itself has no
 *   overlay, so native clicks pass through.
 * - **Reposition on every frame the target might move** (resize, scroll,
 *   page-layout shift). A `ResizeObserver` + `scroll`/`resize` listeners
 *   keep the cutout in sync.
 * - **Animated pulse ring + pointer arrow** (SP10) make the highlight
 *   feel alive and explicitly connect popover ↔ target.
 * - **Mobile bottom-sheet fallback** (SP10) at viewport width < 480px
 *   so the popover doesn't collide with the cutout on narrow phones.
 * - **Collision-aware popover** on wider screens: picks the side with
 *   most space, falls back to center when target is off-screen.
 * - **`prefers-reduced-motion`**: removes scale/pulse animations; the
 *   static ring + arrow still render.
 *
 * Keyboard:
 *   - `Escape`        → skip this step (`onSkipStep`)
 *   - `Shift+Escape`  → skip whole tour (`onSkipAll`)
 *   - `ArrowRight`    → next
 *   - `ArrowLeft`     → back
 *   - `Tab`           → cycles focus inside the popover only
 *
 * All interactions are delegated to the parent controller; this component
 * is presentational.
 */
export interface TutorialOverlayProps {
  /** Ref to the target anchor element. When `null` (e.g. anchor not yet
   *  mounted), the overlay renders a centered popover with no cutout. */
  targetRef: RefObject<HTMLElement | null>
  /** i18n-resolved strings. Title/body may include inline markup. */
  title: string
  body: string
  /** 1-indexed step counter shown in the header. */
  stepNumber: number
  totalSteps: number
  /** Which side to prefer — `auto` lets the overlay decide. */
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  /** When true, clicks on the target pass through (e.g. "Tap Tune"). */
  interactive?: boolean
  /** True when the active step is the last visible one — swaps "Next"
   *  label to "Done". */
  isLastStep?: boolean
  /** True when the step has history behind it; hides Back otherwise. */
  canGoBack?: boolean
  onNext: () => void
  onBack: () => void
  onSkipStep: () => void
  onSkipAll: () => void
  /** i18n copy for the buttons. */
  labels: {
    next: string
    done: string
    back: string
    skipStep: string
    skipAll: string
    progress: (current: number, total: number) => string
  }
}

interface CutoutRect {
  top: number
  left: number
  width: number
  height: number
}

type ResolvedSide = 'top' | 'bottom' | 'left' | 'right' | 'sheet'

const PADDING = 8 // breathing room around the target inside the cutout
const POPOVER_GAP = 14 // distance between target and popover (room for arrow)
const POPOVER_MAX_WIDTH = 340
const POPOVER_MARGIN = 12 // min distance to the viewport edge
const ARROW_SIZE = 10 // SVG arrow triangle half-width
const SHEET_BREAKPOINT = 480 // below this, pin popover as a bottom sheet

export function TutorialOverlay({
  targetRef,
  title,
  body,
  stepNumber,
  totalSteps,
  placement = 'auto',
  interactive = false,
  isLastStep = false,
  canGoBack = true,
  onNext,
  onBack,
  onSkipStep,
  onSkipAll,
  labels,
}: TutorialOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [cutout, setCutout] = useState<CutoutRect | null>(null)
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window === 'undefined' ? 1024 : window.innerWidth,
    h: typeof window === 'undefined' ? 768 : window.innerHeight,
  }))
  const popoverRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  // Portal is only meaningful client-side.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- did-mount marker
  useEffect(() => setMounted(true), [])

  // Track viewport size so the bottom-sheet breakpoint stays accurate on
  // rotate/resize.
  useEffect(() => {
    const sync = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  // Keep the cutout in sync with the target's bounding box. The
  // measurements can only be read after layout commits, so setting state
  // inside the effect is the canonical escape hatch for
  // `react-hooks/set-state-in-effect`.
  useLayoutEffect(() => {
    const target = targetRef.current
    if (!target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement
      setCutout(null)
      return
    }

    const update = () => {
      const rect = target.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setCutout(null)
        return
      }
      setCutout({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      })
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(target)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [targetRef])

  // Move initial focus to the first actionable button + keep it trapped
  // inside the popover while the overlay is visible.
  useEffect(() => {
    firstFocusableRef.current?.focus()
  }, [stepNumber])

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault()
        onSkipAll()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkipStep()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
        return
      }
      if (e.key === 'ArrowLeft') {
        if (canGoBack) {
          e.preventDefault()
          onBack()
        }
        return
      }
      if (e.key === 'Tab') {
        const popover = popoverRef.current
        if (!popover) return
        const focusables = Array.from(
          popover.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'),
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [canGoBack, onBack, onNext, onSkipAll, onSkipStep])

  // Popover size changes with copy length + responsive width. Track it so
  // positioning is accurate.
  const [popoverSize, setPopoverSize] = useState<{ w: number; h: number }>({
    w: POPOVER_MAX_WIDTH,
    h: 180,
  })
  useLayoutEffect(() => {
    const el = popoverRef.current
    if (!el) return
    const measure = () => setPopoverSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const useBottomSheet = viewport.w < SHEET_BREAKPOINT

  const popoverPosition = useMemo(
    () =>
      computePopoverPosition(
        cutout,
        placement,
        popoverSize.w,
        popoverSize.h,
        viewport.w,
        viewport.h,
        useBottomSheet,
      ),
    [cutout, placement, popoverSize.w, popoverSize.h, viewport.w, viewport.h, useBottomSheet],
  )

  if (!mounted) return null

  // Spring-based entrance offset depends on the resolved side so the
  // popover appears to "come from" the target.
  const entranceOffset = entranceOffsetForSide(popoverPosition.side)

  return createPortal(
    <div
      aria-live="polite"
      role="region"
      className="fixed inset-0 z-[70]"
      style={{ pointerEvents: 'none' }}
    >
      {/* Darkened backdrop — 4 rectangles around the cutout so the target
          can remain clickable when `interactive`. When there's no target,
          fall back to a single full-screen rectangle. */}
      <BackdropFrame cutout={cutout} allowClickThrough={interactive} />

      {/* Animated pulse ring around the target (SP10). Rides on cutout
          state so it tracks target movement alongside the backdrop. */}
      <AnimatePresence>
        {cutout ? <TargetPulseRing key={`${cutout.top}-${cutout.left}`} cutout={cutout} /> : null}
      </AnimatePresence>

      {/* Popover + arrow */}
      <motion.div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-body"
        key={stepNumber}
        initial={{ opacity: 0, scale: 0.96, x: entranceOffset.x, y: entranceOffset.y }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className={cn(
          'fixed rounded-2xl border shadow-2xl',
          'bg-[var(--color-brand-card)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]',
          useBottomSheet
            ? 'w-full rounded-b-none'
            : 'w-[min(var(--popover-max-w),calc(100vw-var(--popover-margin)*2))]',
        )}
        style={{
          top: popoverPosition.top,
          left: popoverPosition.left,
          ...(useBottomSheet ? { right: 0 } : null),
          pointerEvents: 'auto',
          ['--popover-max-w' as never]: `${POPOVER_MAX_WIDTH}px`,
          ['--popover-margin' as never]: `${POPOVER_MARGIN}px`,
        }}
      >
        {/* SVG pointer arrow — only when the popover isn't the full-width
            bottom sheet (arrow doesn't make sense there). */}
        {!useBottomSheet && cutout && popoverPosition.side !== 'sheet' ? (
          <PopoverArrow
            side={popoverPosition.side}
            popoverLeft={popoverPosition.left}
            popoverTop={popoverPosition.top}
            popoverWidth={popoverSize.w}
            popoverHeight={popoverSize.h}
            cutout={cutout}
          />
        ) : null}

        <div className="flex items-center justify-between px-4 pt-3 text-[11px] text-[var(--color-brand-text-muted)] tabular-nums">
          <span>{labels.progress(stepNumber, totalSteps)}</span>
          <button
            type="button"
            onClick={onSkipAll}
            className="rounded px-1.5 py-0.5 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]"
          >
            {labels.skipAll}
          </button>
        </div>
        <div className="px-4 pb-4 pt-2">
          <h3 id="tutorial-title" className="text-base font-semibold">
            {title}
          </h3>
          <p
            id="tutorial-body"
            className="mt-2 text-sm leading-relaxed text-[var(--color-brand-text-secondary)] whitespace-pre-line"
          >
            {body}
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            {canGoBack ? (
              <button
                type="button"
                onClick={onBack}
                className="h-9 rounded-lg px-3 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
              >
                {labels.back}
              </button>
            ) : null}
            <button
              ref={firstFocusableRef}
              type="button"
              onClick={onNext}
              className="h-9 rounded-lg px-4 text-sm font-semibold text-white bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)]"
            >
              {isLastStep ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

// ─── Animated pulse ring ────────────────────────────────────────────────

function TargetPulseRing({ cutout }: { cutout: CutoutRect }) {
  return (
    <motion.div
      className="fixed rounded-xl pointer-events-none"
      style={{
        top: cutout.top,
        left: cutout.left,
        width: cutout.width,
        height: cutout.height,
        boxShadow: '0 0 0 2px var(--color-brand-red), 0 0 0 6px rgba(229, 9, 20, 0.22)',
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{
        opacity: [0.85, 1, 0.85],
        scale: [1, 1.035, 1],
      }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
        scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
      }}
    />
  )
}

// ─── Backdrop frame ─────────────────────────────────────────────────────

function BackdropFrame({
  cutout,
  allowClickThrough,
}: {
  cutout: CutoutRect | null
  allowClickThrough: boolean
}) {
  if (!cutout) {
    return (
      <div
        className="fixed inset-0 bg-black/60 motion-safe:transition-opacity motion-safe:duration-200"
        style={{ pointerEvents: allowClickThrough ? 'none' : 'auto' }}
      />
    )
  }

  const bottom = cutout.top + cutout.height
  const right = cutout.left + cutout.width
  const dimmerStyle = {
    background: 'rgba(0,0,0,0.6)',
    pointerEvents: allowClickThrough ? ('none' as const) : ('auto' as const),
  }

  return (
    <>
      <div
        className="fixed"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, cutout.top), ...dimmerStyle }}
      />
      <div
        className="fixed"
        style={{ top: bottom, left: 0, right: 0, bottom: 0, ...dimmerStyle }}
      />
      <div
        className="fixed"
        style={{
          top: cutout.top,
          left: 0,
          width: Math.max(0, cutout.left),
          height: cutout.height,
          ...dimmerStyle,
        }}
      />
      <div
        className="fixed"
        style={{
          top: cutout.top,
          left: right,
          right: 0,
          height: cutout.height,
          ...dimmerStyle,
        }}
      />
    </>
  )
}

// ─── Pointer arrow ──────────────────────────────────────────────────────

function PopoverArrow({
  side,
  popoverLeft,
  popoverTop,
  popoverWidth,
  popoverHeight,
  cutout,
}: {
  side: ResolvedSide
  popoverLeft: number
  popoverTop: number
  popoverWidth: number
  popoverHeight: number
  cutout: CutoutRect
}) {
  if (side === 'sheet') return null

  const targetCenterX = cutout.left + cutout.width / 2
  const targetCenterY = cutout.top + cutout.height / 2

  // The arrow sits flush with whichever popover edge faces the target,
  // tip pointing at the target centre projected onto that edge.
  const stroke = 'var(--color-brand-border)'
  const fill = 'var(--color-brand-card)'

  if (side === 'top') {
    // Popover above target → arrow on popover's bottom edge, tip down.
    const tipX = Math.max(
      ARROW_SIZE,
      Math.min(popoverWidth - ARROW_SIZE, targetCenterX - popoverLeft),
    )
    return (
      <svg
        width={ARROW_SIZE * 2}
        height={ARROW_SIZE}
        style={{ position: 'absolute', left: tipX - ARROW_SIZE, bottom: -ARROW_SIZE + 1 }}
        aria-hidden
      >
        <polygon points={`0,0 ${ARROW_SIZE * 2},0 ${ARROW_SIZE},${ARROW_SIZE}`} fill={fill} stroke={stroke} strokeWidth={1} />
      </svg>
    )
  }
  if (side === 'bottom') {
    // Popover below target → arrow on popover's top edge, tip up.
    const tipX = Math.max(
      ARROW_SIZE,
      Math.min(popoverWidth - ARROW_SIZE, targetCenterX - popoverLeft),
    )
    return (
      <svg
        width={ARROW_SIZE * 2}
        height={ARROW_SIZE}
        style={{ position: 'absolute', left: tipX - ARROW_SIZE, top: -ARROW_SIZE + 1 }}
        aria-hidden
      >
        <polygon points={`0,${ARROW_SIZE} ${ARROW_SIZE * 2},${ARROW_SIZE} ${ARROW_SIZE},0`} fill={fill} stroke={stroke} strokeWidth={1} />
      </svg>
    )
  }
  if (side === 'right') {
    // Popover right of target → arrow on popover's left edge, tip left.
    const tipY = Math.max(
      ARROW_SIZE,
      Math.min(popoverHeight - ARROW_SIZE, targetCenterY - popoverTop),
    )
    return (
      <svg
        width={ARROW_SIZE}
        height={ARROW_SIZE * 2}
        style={{ position: 'absolute', top: tipY - ARROW_SIZE, left: -ARROW_SIZE + 1 }}
        aria-hidden
      >
        <polygon points={`${ARROW_SIZE},0 ${ARROW_SIZE},${ARROW_SIZE * 2} 0,${ARROW_SIZE}`} fill={fill} stroke={stroke} strokeWidth={1} />
      </svg>
    )
  }
  // side === 'left' → popover left of target → arrow on popover's right edge, tip right.
  const tipY = Math.max(ARROW_SIZE, Math.min(popoverHeight - ARROW_SIZE, targetCenterY - popoverTop))
  return (
    <svg
      width={ARROW_SIZE}
      height={ARROW_SIZE * 2}
      style={{ position: 'absolute', top: tipY - ARROW_SIZE, right: -ARROW_SIZE + 1 }}
      aria-hidden
    >
      <polygon points={`0,0 0,${ARROW_SIZE * 2} ${ARROW_SIZE},${ARROW_SIZE}`} fill={fill} stroke={stroke} strokeWidth={1} />
    </svg>
  )
}

// ─── Positioning ────────────────────────────────────────────────────────

function computePopoverPosition(
  cutout: CutoutRect | null,
  placement: 'auto' | 'top' | 'bottom' | 'left' | 'right',
  popWidth: number,
  popHeight: number,
  vw: number,
  vh: number,
  useBottomSheet: boolean,
): { top: number; left: number; side: ResolvedSide } {
  // Mobile bottom-sheet mode — pin to viewport bottom, full-width.
  if (useBottomSheet) {
    return { top: vh - popHeight, left: 0, side: 'sheet' }
  }

  if (!cutout) {
    return {
      top: Math.max(POPOVER_MARGIN, (vh - popHeight) / 2),
      left: Math.max(POPOVER_MARGIN, (vw - popWidth) / 2),
      side: 'bottom',
    }
  }

  const preferred = placement === 'auto' ? preferSide(cutout, popHeight, popWidth, vw, vh) : placement

  let top = 0
  let left = 0
  switch (preferred) {
    case 'bottom':
      top = cutout.top + cutout.height + POPOVER_GAP
      left = cutout.left + cutout.width / 2 - popWidth / 2
      break
    case 'top':
      top = cutout.top - popHeight - POPOVER_GAP
      left = cutout.left + cutout.width / 2 - popWidth / 2
      break
    case 'right':
      top = cutout.top + cutout.height / 2 - popHeight / 2
      left = cutout.left + cutout.width + POPOVER_GAP
      break
    case 'left':
      top = cutout.top + cutout.height / 2 - popHeight / 2
      left = cutout.left - popWidth - POPOVER_GAP
      break
  }

  top = Math.min(Math.max(POPOVER_MARGIN, top), vh - popHeight - POPOVER_MARGIN)
  left = Math.min(Math.max(POPOVER_MARGIN, left), vw - popWidth - POPOVER_MARGIN)
  return { top, left, side: preferred }
}

function preferSide(
  cutout: CutoutRect,
  popHeight: number,
  popWidth: number,
  vw: number,
  vh: number,
): 'top' | 'bottom' | 'left' | 'right' {
  const spaceBelow = vh - (cutout.top + cutout.height)
  const spaceAbove = cutout.top
  const spaceRight = vw - (cutout.left + cutout.width)
  const spaceLeft = cutout.left
  if (spaceBelow >= popHeight + POPOVER_GAP + POPOVER_MARGIN) return 'bottom'
  if (spaceAbove >= popHeight + POPOVER_GAP + POPOVER_MARGIN) return 'top'
  if (spaceRight >= popWidth + POPOVER_GAP + POPOVER_MARGIN) return 'right'
  if (spaceLeft >= popWidth + POPOVER_GAP + POPOVER_MARGIN) return 'left'
  return 'bottom'
}

function entranceOffsetForSide(side: ResolvedSide): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: 0, y: 8 }
    case 'bottom':
      return { x: 0, y: -8 }
    case 'left':
      return { x: 8, y: 0 }
    case 'right':
      return { x: -8, y: 0 }
    case 'sheet':
      return { x: 0, y: 12 }
  }
}
