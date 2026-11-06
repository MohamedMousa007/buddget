import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { inkOn, monogram } from './accountDisplay'

interface BrandMarkProps {
  name: string
  color: string
  /** px; the list uses 44, pickers 32–36. */
  size?: number
  /** Amber exception badge (a gap to resolve). */
  alert?: boolean
  icon?: ReactNode
  className?: string
}

/** The squircle monogram that stands for a bank, wallet or cash. */
export function BrandMark({ name, color, size = 44, alert, icon, className }: BrandMarkProps) {
  return (
    <span
      aria-hidden
      className={cn('relative inline-flex shrink-0 items-center justify-center font-bold', className)}
      style={{ width: size, height: size, borderRadius: size * 0.32, background: color, color: inkOn(color), fontSize: size * 0.27, letterSpacing: '0.02em' }}
    >
      {icon ?? monogram(name)}
      {alert ? (
        <span className="absolute -end-1 -top-1 flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-amber)] text-[0.625rem] font-extrabold text-[var(--color-brand-card)]">!</span>
      ) : null}
    </span>
  )
}
