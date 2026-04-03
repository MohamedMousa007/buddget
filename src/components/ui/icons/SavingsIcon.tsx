import { forwardRef } from 'react'
import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Minimal line icon: coin with crescent (Islamic savings motif). Lucide-aligned: 24×24, stroke 2, round caps/joins.
 */
export const SavingsIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function SavingsIcon({ className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(className)}
        aria-hidden
        {...props}
      >
        {/* Coin */}
        <circle cx="12" cy="14" r="5" />
        {/* Crescent on coin — Lucide moon path, scaled and shifted to sit on top of coin */}
        <g transform="translate(12 7.75) scale(0.36) translate(-12 -12)">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </g>
      </svg>
    )
  }
)
