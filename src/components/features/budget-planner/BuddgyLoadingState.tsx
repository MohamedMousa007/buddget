'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface BuddgyLoadingStateProps {
  title?: string
  messages: string[]
  /** How often to rotate status copy (ms). */
  intervalMs?: number
}

/**
 * Pulsing dots + crossfading status copy for Buddgy AI steps (no progress bar).
 */
export function BuddgyLoadingState({ title, messages, intervalMs = 2000 }: BuddgyLoadingStateProps) {
  const [i, setI] = useState(0)
  const safe = messages.length > 0 ? messages : title ? [title] : ['Working…']

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => (n + 1) % safe.length)
    }, intervalMs)
    return () => clearInterval(t)
  }, [safe.length, intervalMs])

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex gap-2">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="h-2 w-2 rounded-full bg-[var(--color-brand-red)]"
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.92, 1, 0.92] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: dot * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {title ? (
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{title}</p>
      ) : null}

      <div className="relative min-h-[1.35rem] w-full max-w-sm text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={safe[i % safe.length]}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="text-sm text-[var(--color-brand-text-secondary)]"
          >
            {safe[i % safe.length]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
