'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

export interface StatusPillProps {
  /** 16px glyph, drawn in amber. */
  icon: ReactNode
  label: string
  tone?: 'amber'
  /** False while the owner keeps it hidden after a swipe; the hint can still show. */
  visible?: boolean
  /** Swipe up hides it; the owner decides when it may come back. */
  onHide: () => void
  /** Shown for 2 s once hidden, e.g. "Hidden · returns if still offline in 10 min". */
  hiddenHint?: ReactNode
}

/**
 * A state, not a question: offline, sync failed. Centred under the status bar, amber on
 * the card colour, and gone by itself when the state clears. Swiping up hides it (the
 * same gesture as the prompt stack); it only returns if the state still holds later.
 */
export function StatusPill({ icon, label, visible = true, onHide, hiddenHint }: StatusPillProps) {
  const y = useMotionValue(0)
  const opacity = useTransform(y, [-60, 0], [0.45, 1])
  const [hinting, setHinting] = useState(false)

  useEffect(() => {
    if (!hinting) return
    const id = window.setTimeout(() => setHinting(false), 2000)
    return () => window.clearTimeout(id)
  }, [hinting])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (-info.offset.y > 40 || -info.velocity.y > 500) {
      if (hiddenHint) setHinting(true)
      onHide()
    }
  }

  return (
    <div data-inert-exempt className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+7px)] lg:start-[var(--sidebar-w)] lg:top-[calc(var(--app-header-h-lg)+8px)] z-[58] flex flex-col items-center gap-2.5">
      {visible ? (
      <motion.div
        role="status"
        aria-label={label}
        className="pointer-events-auto inline-flex h-9 touch-none items-center gap-2 whitespace-nowrap rounded-full border border-[color-mix(in_oklab,var(--color-brand-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-brand-amber)_18%,var(--color-brand-card))] pe-1.5 ps-3 text-[12.5px] font-semibold text-[var(--color-brand-text-primary)] shadow-[var(--shadow-md)]"
        style={{ y, opacity }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 1, bottom: 0.1 }}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        <span className="flex text-[var(--color-brand-amber)] [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
        <span className="pe-1.5">{label}</span>
      </motion.div>
      ) : null}
      <AnimatePresence>
        {hinting && hiddenHint ? <PillHint>{hiddenHint}</PillHint> : null}
      </AnimatePresence>
    </div>
  )
}

/** The small card-coloured note that confirms a hide or a snooze. */
export function PillHint({ children }: { children: ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-brand-text-primary)] shadow-[var(--shadow-md)]"
    >
      <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden />
      {children}
    </motion.span>
  )
}
