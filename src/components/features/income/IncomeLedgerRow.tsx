'use client'

import { useState, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Trash2, Link2 } from 'lucide-react'

const THRESHOLD = 96

interface Props {
  children: ReactNode
  onDelete: () => void
  /** Right-swipe assign is only meaningful for unlinked one-time receipts. */
  canAssign: boolean
  onAssign: () => void
  deleteLabel: string
  assignLabel: string
}

/**
 * All-income row: swipe left past threshold → Delete (red), swipe right → Assign
 * (green). Action fires on release past the threshold; otherwise snaps back
 * (handoff §8). Assign is disabled (drag clamped to left) when not applicable.
 */
export function IncomeLedgerRow({ children, onDelete, canAssign, onAssign, deleteLabel, assignLabel }: Props) {
  const x = useMotionValue(0)
  const [dir, setDir] = useState<0 | 1 | -1>(0)
  const assignOpacity = useTransform(x, [0, THRESHOLD], [0, 1])
  const deleteOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0])

  return (
    <div className="relative overflow-hidden">
      {/* Assign underlay (right swipe) */}
      {canAssign ? (
        <motion.div
          style={{ opacity: assignOpacity }}
          className="absolute inset-y-0 start-0 flex items-center gap-1.5 bg-[rgba(29,185,84,0.18)] px-4 text-[var(--color-brand-green)]"
        >
          <Link2 className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-[0.04em]">{assignLabel}</span>
        </motion.div>
      ) : null}
      {/* Delete underlay (left swipe) */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-y-0 end-0 flex items-center gap-1.5 bg-[rgba(229,9,20,0.18)] px-4 text-[var(--color-brand-red)]"
      >
        <span className="text-xs font-bold uppercase tracking-[0.04em]">{deleteLabel}</span>
        <Trash2 className="h-4 w-4" />
      </motion.div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -THRESHOLD * 1.6, right: canAssign ? THRESHOLD * 1.6 : 0 }}
        dragElastic={0.25}
        onDrag={(_, info) => setDir(info.offset.x > 4 ? 1 : info.offset.x < -4 ? -1 : 0)}
        onDragEnd={(_, info) => {
          if (info.offset.x < -THRESHOLD) onDelete()
          else if (canAssign && info.offset.x > THRESHOLD) onAssign()
          x.set(0)
          setDir(0)
        }}
        className="relative bg-[var(--color-brand-card)]"
        data-swiping={dir !== 0 ? '' : undefined}
      >
        {children}
      </motion.div>
    </div>
  )
}
