'use client'

import { MotionConfig } from 'framer-motion'

/**
 * Respects OS `prefers-reduced-motion` for all Framer Motion descendants.
 */
export function MotionConfigRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
