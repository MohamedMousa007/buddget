'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  count: number
  activeIndex: number
  onActiveChange: (i: number) => void
  renderItem: (index: number) => ReactNode
  /** Page-dot color. Handoff: red on the assign slider; red on the page too. */
  dotColor?: string
}

/**
 * One-card-per-swipe horizontal carousel (handoff §4/§8). Native CSS scroll-snap
 * pages one card at a time and leaves vertical page scroll untouched; a scroll
 * listener syncs the active index, and page-dots jump programmatically.
 */
export function RecurringIncomeCarousel({ count, activeIndex, onActiveChange, renderItem, dotColor = '#E50914' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  // Keep the scroll position in sync when the active index is driven from outside
  // (e.g. assign sheet auto-centering the default source).
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const target = activeIndex * el.clientWidth
    if (Math.abs(el.scrollLeft - target) > 4) el.scrollTo({ left: target, behavior: 'smooth' })
  }, [activeIndex])

  const onScroll = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el || el.clientWidth === 0) return
      const i = Math.round(el.scrollLeft / el.clientWidth)
      if (i !== activeIndex && i >= 0 && i < count) onActiveChange(i)
    })
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [touch-action:pan-x_pan-y]"
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-0.5">
            {renderItem(i)}
          </div>
        ))}
      </div>
      {count > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to ${i + 1}`}
              onClick={() => onActiveChange(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIndex ? 16 : 6,
                background: i === activeIndex ? dotColor : 'rgba(255,255,255,0.22)',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
