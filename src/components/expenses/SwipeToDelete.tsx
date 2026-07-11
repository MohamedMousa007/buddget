'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { REVEAL, resolveSwipe, resolveSwipeRight } from './swipeToDeleteLogic'

export type SwipeSide = 'left' | 'right'

async function tapHaptic() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* web / haptics unavailable */
  }
}

interface RightAction {
  label: string
  icon: ReactNode
  onAction: () => void
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

function AssignPanel({ action }: { action: RightAction }) {
  return (
    <div className="absolute inset-y-0 start-0 flex" style={{ width: REVEAL }}>
      <button
        type="button"
        aria-label={action.label}
        onClick={() => { void tapHaptic(); action.onAction() }}
        className="flex w-full flex-col items-center justify-center gap-0.5 bg-[var(--color-brand-green)] text-white active:opacity-90"
      >
        {action.icon}
        <span className="text-[10px] font-semibold">{action.label}</span>
      </button>
    </div>
  )
}

/**
 * Reveal-and-tap swipe row. Swipe **left** past a deliberate (near-mid-card,
 * velocity-ignored) threshold to expose the Delete button; optionally swipe
 * **right** to expose {@link rightAction} (e.g. Assign). A tap on the revealed
 * button confirms; one row stays open at a time via `openSide`/`onOpenChange`.
 */
export function SwipeToDelete({
  children,
  onDelete,
  openSide,
  onOpenChange,
  deleteLabel,
  rightAction,
}: {
  children: ReactNode
  onDelete: () => void
  openSide: SwipeSide | null
  onOpenChange: (side: SwipeSide | null) => void
  deleteLabel: string
  rightAction?: RightAction
}) {
  const x = useMotionValue(0)
  const didDrag = useRef(false)

  // Follow external open state (another row opened → close this one).
  useEffect(() => {
    const target = openSide === 'left' ? -REVEAL : openSide === 'right' ? REVEAL : 0
    if (x.get() !== target) animate(x, target, { type: 'spring', stiffness: 500, damping: 40 })
  }, [openSide, x])

  const handleDragEnd = (_: unknown, _info: PanInfo) => {
    const pos = x.get()
    const side: SwipeSide | null = resolveSwipe(pos)
      ? 'left'
      : rightAction && resolveSwipeRight(pos)
        ? 'right'
        : null
    if (side) void tapHaptic()
    animate(x, side === 'left' ? -REVEAL : side === 'right' ? REVEAL : 0, { type: 'spring', stiffness: 500, damping: 40 })
    onOpenChange(side)
  }

  // Capture-phase guard: swallow the row tap when a drag just happened or the
  // row is open (first tap on an open row just closes it) — never a ghost edit.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didDrag.current || openSide) {
      e.preventDefault()
      e.stopPropagation()
      if (openSide) onOpenChange(null)
    }
  }

  return (
    <div className="relative overflow-hidden" onPointerDownCapture={() => { didDrag.current = false }}>
      <DeletePanel deleteLabel={deleteLabel} onDelete={onDelete} />
      {rightAction ? <AssignPanel action={rightAction} /> : null}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -210, right: rightAction ? 210 : 0 }}
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
