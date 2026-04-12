'use client'

import { cn } from '@/lib/utils'

type Phase = 'survey' | 'plans'

/**
 * YNAB-style segmented bar: past steps read as “done,” current step slightly brighter, rest muted.
 */
export function OnboardingJourneyProgress({
  totalSteps,
  currentIndex,
  phase,
}: {
  totalSteps: number
  currentIndex: number
  phase: Phase
}) {
  const n = Math.max(1, totalSteps)
  const safeIndex = Math.min(Math.max(0, currentIndex), n - 1)

  return (
    <div
      className="flex gap-0.5 w-full max-w-xl mt-2"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={n}
      aria-valuenow={phase === 'plans' ? n : safeIndex + 1}
      aria-label="Your setup progress"
    >
      {Array.from({ length: n }, (_, i) => {
        const done = phase === 'plans' || i < safeIndex
        const current = phase === 'survey' && i === safeIndex
        return (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 min-w-[2px] rounded-full transition-all duration-300',
              done && 'bg-[var(--color-brand-red)] shadow-[0_0_8px_rgba(229,9,20,0.35)]',
              current && 'bg-[var(--color-brand-text-primary)]/70 ring-1 ring-[var(--color-brand-text-primary)]/30',
              !done && !current && 'bg-[var(--color-brand-border)]/45'
            )}
          />
        )
      })}
    </div>
  )
}
