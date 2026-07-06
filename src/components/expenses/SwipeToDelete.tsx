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

  // Follow external open state (e.g. another row opened → close this one).
  useEffect(() => {
    const target = isOpen ? -REVEAL : 0
    if (x.get() !== target) animate(x, target, { type: 'spring', stiffness: 500, damping: 40 })
  }, [isOpen, x])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const target = resolveSwipe(x.get(), info.velocity.x)
    animate(x, target, { type: 'spring', stiffness: 500, damping: 40 })
    onOpenChange(target !== 0)
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
    <div className="relative" onPointerDownCapture={() => { didDrag.current = false }}>
      <div className="absolute inset-y-0 end-0 flex" style={{ width: REVEAL }}>
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={() => { void tapHaptic(); onDelete() }}
          className="flex w-full flex-col items-center justify-center gap-0.5 bg-[var(--color-brand-red)] text-white active:bg-[var(--color-brand-red-hover)]"
        >
          <Trash2 className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{deleteLabel}</span>
        </button>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={0.05}
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
