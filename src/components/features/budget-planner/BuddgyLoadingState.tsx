'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export interface BuddgyLoadingStateProps {
  title: string
  messages: string[]
}

/**
 * Indeterminate progress + rotating status copy for Buddgy AI steps.
 */
export function BuddgyLoadingState({ title, messages }: BuddgyLoadingStateProps) {
  const [i, setI] = useState(0)
  const safe = messages.length > 0 ? messages : [title]

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => (n + 1) % safe.length)
    }, 1500)
    return () => clearInterval(t)
  }, [safe.length])

  return (
    <div className="space-y-5 py-2">
      <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="text-sm text-[var(--color-brand-text-secondary)] min-h-[1.25rem] transition-opacity duration-300">
        {safe[i % safe.length]}
      </p>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)]">
        <motion.div
          className="absolute left-0 top-0 h-full w-2/5 rounded-full bg-[var(--color-brand-red)]/75"
          initial={{ x: '-100%' }}
          animate={{ x: ['0%', '260%'] }}
          transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}
