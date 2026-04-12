'use client'

import * as React from 'react'
import type { LucideProps } from 'lucide-react'

/**
 * Stroke-only savings mark: drawstring coin bag with a dollar sign and coins spilling below.
 * Matches Lucide 24×24 outline style (currentColor, round caps/joins).
 */
export const SavingsIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, className, absoluteStrokeWidth, ...props }, ref) => {
    const sw =
      absoluteStrokeWidth && size
        ? (Number(strokeWidth) * 24) / Number(size)
        : strokeWidth

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {/* Drawstring coin bag */}
        <path d="M 11.35 5.15 Q 12 4.5 12.65 5.15 L 14.35 7.15 C 16.05 9.35 15.85 13.55 14.15 15.55 C 13.05 16.95 10.95 16.95 9.85 15.55 C 8.15 13.55 7.95 9.35 9.65 7.15 L 11.35 5.15 Z" />
        {/* Dollar (same topology as Lucide DollarSign, compact for bag) */}
        <line x1="12" y1="9.35" x2="12" y2="14.85" />
        <path d="M 13.55 9.35 H 10.05 a 1.15 1.15 0 0 0 0 2.3 h 2.35 a 1.15 1.15 0 0 1 0 2.3 H 9.85" />
        {/* Coins falling from the bag (staggered) */}
        <circle cx="11.45" cy="17.35" r="1.15" />
        <circle cx="9.05" cy="19.25" r="1.15" />
        <circle cx="12" cy="20.6" r="1.15" />
        <circle cx="14.95" cy="19.05" r="1.15" />
      </svg>
    )
  }
)

SavingsIcon.displayName = 'SavingsIcon'
