'use client'

import { cn } from '@/lib/utils'

type GoalProgressBarProps = {
  percent: number | null
  className?: string
  thin?: boolean
}

/** Thin progress bar for goals (0–100). */
export function GoalProgressBar({ percent, className, thin }: GoalProgressBarProps) {
  const p = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  return (
    <div
      className={cn(
        'w-full rounded-full bg-[var(--color-brand-elevated)] overflow-hidden',
        thin ? 'h-1' : 'h-2',
        className
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-red)] to-[var(--color-brand-red-hover)] transition-all duration-500"
        style={{ width: `${p}%` }}
      />
    </div>
  )
}
