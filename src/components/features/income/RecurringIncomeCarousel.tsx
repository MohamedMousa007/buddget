'use client'

import { useRef, useState, type ReactNode, type PointerEvent } from 'react'

interface Props {
  count: number
  activeIndex: number
  onActiveChange: (i: number) => void
  renderItem: (index: number) => ReactNode
  /** Page-dot color. Red on the page + assign slider. */
  dotColor?: string
}

const TAP_SLOP = 6

/**
 * One-card-per-swipe hero carousel (handoff §4/§8). Full-width cards with a
 * finger-follow pointer drag + ease-settle on release (modelled on the payment
 * card deck, minus the peek). Controlled — external `activeIndex` changes animate
 * too (the assign sheet auto-centres the default source). Vertical page scroll is
 * preserved via `touch-action: pan-y` and a vertical-intent bail-out.
 */
export function RecurringIncomeCarousel({ count, activeIndex, onActiveChange, renderItem, dotColor = '#E50914' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const width = () => trackRef.current?.clientWidth ?? 1

  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
    axis.current = null
    setDragging(true)
    // Capture so move/up keep firing even when the finger leaves the track —
    // fixes swipes that "fail" mid-drag.
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (axis.current === null) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axis.current === 'v') {
        // Vertical intent → let the page scroll; abandon this gesture.
        start.current = null
        setDragging(false)
        setDragX(0)
        return
      }
    }
    if (axis.current !== 'h') return
    // Rubber-band past the ends.
    let x = dx
    if ((activeIndex === 0 && x > 0) || (activeIndex === count - 1 && x < 0)) x *= 0.35
    setDragX(x)
  }
  const endDrag = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s || axis.current !== 'h') {
      setDragX(0)
      return
    }
    const moved = dragX / width()
    let next = activeIndex
    if (moved <= -0.2) next = Math.min(activeIndex + 1, count - 1)
    else if (moved >= 0.2) next = Math.max(activeIndex - 1, 0)
    setDragX(0)
    if (next !== activeIndex) onActiveChange(next)
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="relative overflow-hidden [touch-action:pan-y]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(${-activeIndex * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform .38s cubic-bezier(.22,1,.36,1)',
          }}
        >
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="w-full shrink-0 px-0.5">
              {renderItem(i)}
            </div>
          ))}
        </div>
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
              style={{ width: i === activeIndex ? 16 : 6, background: i === activeIndex ? dotColor : 'rgba(255,255,255,0.22)' }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
