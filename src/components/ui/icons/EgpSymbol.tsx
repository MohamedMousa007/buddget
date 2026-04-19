import { cn } from '@/lib/utils'

export interface EgpSymbolProps {
  className?: string
  title?: string
}

/**
 * "A3 Jeem sovereign" Egyptian Pound mark — a geometric interpretation of
 * the Arabic letter ج with an integrated jeem dot and two horizontal
 * currency bars (echoing the ₹ / ₺ dual-bar convention). Inherits its
 * surrounding text colour via `currentColor` so it works on every surface
 * (dark hero, light card, red over-budget amount, etc.) without tweaks.
 *
 * Aspect ratio 140:160 — callers sizing with `em`-relative classes get
 * automatic baseline alignment against the adjacent numeric value.
 */
export function EgpSymbol({ className, title = 'Egyptian Pound' }: EgpSymbolProps) {
  return (
    <svg
      viewBox="0 0 140 160"
      role="img"
      aria-label={title}
      className={cn('inline-block align-[-0.15em]', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path
        d="M 30 38 L 110 38 Q 110 38 110 55 Q 110 78 88 92 Q 70 102 50 108"
        strokeWidth="9"
      />
      <circle cx="70" cy="128" r="4.5" fill="currentColor" stroke="none" />
      <line x1="30" y1="138" x2="110" y2="138" strokeWidth="6" />
      <line x1="30" y1="150" x2="110" y2="150" strokeWidth="6" />
    </svg>
  )
}
