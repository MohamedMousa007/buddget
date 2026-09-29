'use client'

import * as React from 'react'
import type { LucideProps } from 'lucide-react'

/** Flow tab glyph: a banknote with an in-arrow and an out-arrow (design/…/assets/flow-tab-icon.svg). */
export const FlowTabIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 1.75, className, absoluteStrokeWidth, ...props }, ref) => {
    const sw = absoluteStrokeWidth && size ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth
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
        <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="M8.5 9.5v5" />
        <path d="m6.5 12.5 2 2 2-2" />
        <path d="M15.5 14.5v-5" />
        <path d="m13.5 11.5 2-2 2 2" />
      </svg>
    )
  },
)
FlowTabIcon.displayName = 'FlowTabIcon'
