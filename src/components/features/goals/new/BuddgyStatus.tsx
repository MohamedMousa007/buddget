'use client'

import { useEffect, useState } from 'react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useT } from '@/lib/i18n'

/**
 * Buddgy at work: cycles through what it is doing so a wait never looks stuck, and says so once it is
 * taking longer than usual. The status changes about every two seconds.
 */
export function BuddgyStatus({ steps }: { steps: readonly string[] }) {
  const slow = useT().goals.flow.status.slow
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1800)
    return () => clearInterval(id)
  }, [])
  const text = tick >= steps.length * 2 + 1 ? slow : steps[Math.min(tick, steps.length - 1)]
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-[var(--color-brand-text-secondary)]">
      <BuddgyIcon mood="thinking" size={22} />
      <span key={text} className="animate-in fade-in duration-300">{text}</span>
    </p>
  )
}
