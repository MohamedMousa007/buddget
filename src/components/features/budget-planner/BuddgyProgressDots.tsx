'use client'

import { motion } from 'framer-motion'

const STEPS = ['describe', 'confirm', 'lifestyle', 'savings', 'plan', 'applied'] as const

interface BuddgyProgressDotsProps {
  currentIndex: number
}

/**
 * Minimal progress indicator: 6 dots, active dot is larger and branded.
 */
export function BuddgyProgressDots({ currentIndex }: BuddgyProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((_, i) => {
        const isActive = i === currentIndex
        const isDone = i < currentIndex
        return (
          <motion.div
            key={i}
            className="rounded-full"
            animate={{
              width: isActive ? 20 : 6,
              height: 6,
              backgroundColor: isActive
                ? 'var(--color-brand-red)'
                : isDone
                  ? 'var(--color-brand-green)'
                  : 'var(--color-brand-border)',
            }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          />
        )
      })}
    </div>
  )
}
