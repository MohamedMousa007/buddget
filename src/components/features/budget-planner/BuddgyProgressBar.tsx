'use client'

import { motion } from 'framer-motion'

export function BuddgyProgressBar({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, progress))
  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--color-brand-border)]">
      <motion.div
        className="h-full bg-[var(--color-brand-red)]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      />
    </div>
  )
}
