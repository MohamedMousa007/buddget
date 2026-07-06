'use client'

import { useRef } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { COMMIT_FRACTION, resolveSwipe } from './swipeToDeleteLogic'

async function tapHaptic() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* web / haptics unavailable */
  }
}

/**
 * One-direction (right-to-left) swipe-to-delete. The row must travel almost its
 * whole width left before a release commits the delete — a fast flick never
 * triggers it (velocity is ignored) and there is no shallow reveal to mis-tap. A
 * single haptic fires when the drag crosses the commit threshold. Deletion is
 * immediate on release; the caller surfaces an undo toast.
 */
export function SwipeToDelete({
  children,
  onDelete,
  deleteLabel,
}: {
  children: React.ReactNode
  onDelete: () => void
  deleteLabel: string
}) {
  const x = useMotionValue(0)
  const rowRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(0)
  const didDrag = useRef(false)
  const armed = useRef(false)

  const handleDragStart = () => {
    didDrag.current = true
    armed.current = false
    widthRef.current = rowRef.current?.offsetWidth ?? 0
  }

  const handleDrag = () => {
    const w = widthRef.current
    if (!w) return
    const past = -x.get() >= w * COMMIT_FRACTION
    if (past && !armed.current) {
      armed.current = true
      void tapHaptic()
    } else if (!past && armed.current) {
      armed.current = false
    }
  }

  const handleDragEnd = (_: unknown, _info: PanInfo) => {
    if (resolveSwipe(x.get(), widthRef.current)) {
      void tapHaptic()
      onDelete()
      return
    }
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
  }

  // Capture-phase guard: swallow the row tap when a drag just happened so a swipe
  // never fires the row's edit action as a ghost click.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didDrag.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div
      ref={rowRef}
      className="relative overflow-hidden"
      onPointerDownCapture={() => { didDrag.current = false }}
    >
      <div className="absolute inset-y-0 end-0 start-0 flex items-stretch justify-end bg-[var(--color-brand-red)] text-white">
        <div className="flex flex-col items-center justify-center gap-0.5 px-5">
          <Trash2 className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{deleteLabel}</span>
        </div>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        // Left ceiling is generous (full row travel); the card springs back on
        // release unless the commit threshold is crossed. right:0 = one-direction.
        dragConstraints={{ left: -2000, right: 0 }}
        dragElastic={0.05}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClickCapture={handleClickCapture}
        style={{ x, background: 'var(--color-brand-card)' }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  )
}
