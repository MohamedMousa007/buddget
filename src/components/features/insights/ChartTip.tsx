'use client'

import { useCallback, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Tip {
  text: string
  x: number
  y: number
}

/**
 * One floating label per chart, for hover and tap alike: `bind(text)` goes on a mark, the bubble follows the pointer
 * inside the chart's box. Pointer events cover mouse, pen and touch, so a tap shows the same label a hover does.
 */
export function useChartTip() {
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const place = useCallback((text: string, e: PointerEvent) => {
    const rect = box?.getBoundingClientRect()
    if (rect) setTip({ text, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [box])
  const bind = useCallback(
    (text: string) => ({
      onPointerEnter: (e: PointerEvent) => place(text, e),
      onPointerMove: (e: PointerEvent) => place(text, e),
      onPointerDown: (e: PointerEvent) => {
        // The box clears the tip on a tap that misses every mark; a mark keeps it.
        e.stopPropagation()
        place(text, e)
      },
    }),
    [place],
  )
  return { setBox, tip, bind, hide: () => setTip(null) }
}

/**
 * The chart's box: positions the bubble. A mouse or pen clears it on leaving; touch fires `pointerleave` right after
 * the finger lifts, so a tapped tip stays until the next tap outside the marks.
 */
export function ChartBox({ tip, boxRef, onLeave, children, className }: { tip: Tip | null; boxRef: (el: HTMLDivElement | null) => void; onLeave: () => void; children: ReactNode; className?: string }) {
  return (
    <div ref={boxRef} className={cn('relative', className)} onPointerLeave={(e) => (e.pointerType === 'touch' ? undefined : onLeave())} onPointerDown={onLeave}>
      {children}
      {tip ? (
        <span
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[var(--color-brand-text-primary)] px-2 py-1 font-mono-numbers text-[0.6875rem] font-semibold text-[var(--color-brand-card)] shadow-[var(--shadow-md)]"
          style={{ left: `clamp(64px, ${tip.x}px, calc(100% - 64px))`, top: Math.max(22, tip.y - 10) }}
        >
          {tip.text}
        </span>
      ) : null}
    </div>
  )
}
