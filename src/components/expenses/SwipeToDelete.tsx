'use client'

import { useEffect, useRef } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { REVEAL, resolveSwipe } from './swipeToDeleteLogic'

async function tapHaptic() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* web / haptics unavailable */
  }
}

function DeletePanel({ deleteLabel, onDelete }: { deleteLabel: string; onDelete: () => void }) {
  return (
    <div className="absolute inset-y-0 end-0 flex" style={{ width: REVEAL }}>
      <button
        type="button"
        aria-label={deleteLabel}
        onClick={() => { void tapHaptic(); onDelete() }}
        className="flex w-full flex-col items-center justify-center gap-0.5 bg-[var(--color-brand-red)] text-white active:bg-[var(--color-brand-red-hover)]"
      >
        <Trash2 className="h-5 w-5" />
        <span className="text-[10px] font-semibold">{deleteLabel}</span>
      </button>
    </div>
  )
}

/**
 * One-direction (right-to-left) reveal-and-tap swipe-to-delete. A deliberate,
 * near-mid-card swipe snaps the row open to expose a Delete button (a fast flick
 * won't trip it — velocity is ignored); a tap on that button deletes. Only one
 * row stays open at a time via isOpen/onOpenChange.
 */
export function SwipeToDelete({
  children,
  onDelete,
  isOpen,
  onOpenChange,
  deleteLabel,
}: {
  children: React.ReactNode
  onDelete: () => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  deleteLabel: string
}) {
  const x = useMotionValue(0)
  const didDrag = useRef(false)

  // Follow external open state (another row opened → close this one).
  useEffect(() => {
    const target = isOpen ? -REVEAL : 0
    if (x.get() !== target) animate(x, target, { type: 'spring', stiffness: 500, damping: 40 })
  }, [isOpen, x])

  const handleDragEnd = (_: unknown, _info: PanInfo) => {
    const open = resolveSwipe(x.get())
    if (open) void tapHaptic()
    animate(x, open ? -REVEAL : 0, { type: 'spring', stiffness: 500, damping: 40 })
    onOpenChange(open)
  }

  // Capture-phase guard: swallow the row tap when a drag just happened or the
  // row is open (first tap on an open row just closes it) — never a ghost edit.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didDrag.current || isOpen) {
      e.preventDefault()
      e.stopPropagation()
      if (isOpen) onOpenChange(false)
    }
  }

  return (
    <div className="relative overflow-hidden" onPointerDownCapture={() => { didDrag.current = false }}>
      <DeletePanel deleteLabel={deleteLabel} onDelete={onDelete} />
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -210, right: 0 }}
        dragElastic={0.06}
        onDragStart={() => { didDrag.current = true }}
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
