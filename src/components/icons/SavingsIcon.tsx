'use client'

import * as React from 'react'
import type { LucideProps } from 'lucide-react'

/**
 * Stroke-only savings mark: stacked coins with a small crescent + star on the top face.
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
        {/* Three coin rims (bottom → top), slight vertical stack */}
        <ellipse cx="12" cy="17.5" rx="6" ry="1.85" />
        <ellipse cx="12" cy="14" rx="6" ry="1.85" />
        <ellipse cx="12" cy="10.5" rx="6" ry="1.85" />
        {/* Crescent on top coin — twin curves, horns to the left */}
        <path d="M 8.9 10.05 Q 10.35 8.95 11.85 10.35" />
        <path d="M 8.9 10.95 Q 10.35 12.05 11.85 10.65" />
        {/* Compact star (crossed strokes) */}
        <path d="M 13.15 9.7 13.85 10.9 M 13.85 9.7 13.15 10.9" />
      </svg>
    )
  }
)

SavingsIcon.displayName = 'SavingsIcon'
