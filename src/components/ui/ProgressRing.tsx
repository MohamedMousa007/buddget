'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Arc length for `pct` (clamped 0-100) on a circle of radius `r`. */
export function ringDash(pct: number, r: number): { dash: number; circumference: number } {
  const circumference = 2 * Math.PI * r
  return { dash: (Math.max(0, Math.min(100, pct)) / 100) * circumference, circumference }
}

export interface ProgressRingProps {
  pct: number
  /** Outer box in px. */
  size?: number
  stroke?: number
  /** CSS colour for the unfilled track. Default is the card border; on a band pass `--flow-band-mix`. */
  track?: string
  /** CSS colour for the arc. Default is brand green; on a band pass `--flow-band-fg`. */
  arc?: string
  /** Centre content; defaults to nothing. */
  children?: ReactNode
  className?: string
}

/** A circular progress mark: debt cleared, setup completion. Colours are tokens, never hex. */
export function ProgressRing({
  pct,
  size = 62,
  stroke = 5,
  track = 'var(--color-brand-border)',
  arc = 'var(--color-brand-green)',
  children,
  className,
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const { dash, circumference } = ringDash(pct, r)
  return (
    <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90 rtl:scale-x-[-1]" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      {children ? <span className="absolute inset-0 flex items-center justify-center">{children}</span> : null}
    </span>
  )
}
