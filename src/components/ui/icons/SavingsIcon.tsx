import { forwardRef } from 'react'
import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Islamic savings motif: coin + crescent. Stroke-only; matches Lucide nav weight via non-scaling stroke on the scaled moon.
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
        <circle cx="12" cy="14" r="5" />
        {/* Proven moon outline; scaled to sit on coin; stroke stays 2px in screen space */}
        <g transform="translate(12 9.25) scale(0.34) translate(-12 -12)">
          <path
            vectorEffect="nonScalingStroke"
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          />
        </g>
      </svg>
    )
  }
)
