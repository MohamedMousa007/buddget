'use client'

import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useRef, useState, type ReactNode, type PointerEvent } from 'react'

interface Props {
  count: number
  activeIndex: number
  onActiveChange: (i: number) => void
  renderItem: (index: number) => ReactNode
  /** Page-dot color. Red on the page + assign slider. */
  dotColor?: string
  /** Active page-dot width (px). Income uses 16; debt spec wants 18. */
  activeDotWidth?: number
  /** From lg render every item as a 2-up grid instead of a swipe carousel. */
  lgGrid?: boolean
}

const TAP_SLOP = 6

/**
 * One-card-per-swipe hero carousel (handoff §4/§8). Full-width cards with a
 * finger-follow pointer drag + ease-settle on release (modelled on the payment
 * card deck, minus the peek). Controlled — external `activeIndex` changes animate
 * too (the assign sheet auto-centres the default source). Vertical page scroll is
 * preserved via `touch-action: pan-y` and a vertical-intent bail-out.
 */
export function RecurringIncomeCarousel({ count, activeIndex, onActiveChange, renderItem, dotColor = 'var(--color-brand-primary)', activeDotWidth = 16, lgGrid = false }: Props) {
  const t = useT()
  const trackRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const width = () => trackRef.current?.clientWidth ?? 1

  const onPointerDown = (e: PointerEvent) => {
    if (lgGrid && window.matchMedia('(min-width: 1024px)').matches) return
    start.current = { x: e.clientX, y: e.clientY }
    axis.current = null
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (axis.current === null) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      // Capture only once it is a swipe: capturing on pointerdown retargets the click to the
      // track, so mouse clicks on a card's buttons (Pay, kebab, Set goal) never fired.
      if (axis.current === 'h') e.currentTarget.setPointerCapture?.(e.pointerId)
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
        className={cn('relative overflow-hidden [touch-action:pan-y]', lgGrid && 'lg:overflow-visible')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={cn('flex', lgGrid && 'lg:grid lg:grid-cols-2 lg:gap-4 lg:!transform-none')}
          style={{
            transform: `translateX(calc(${-activeIndex * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform .38s cubic-bezier(.22,1,.36,1)',
          }}
        >
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className={cn('w-full shrink-0 px-0.5', lgGrid && 'lg:min-w-0 lg:px-0')}>
              {renderItem(i)}
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <div className={cn('mt-3 flex items-center justify-center gap-2', lgGrid && 'lg:hidden')}>
          {Array.from({ length: count }, (_, i) => (
            <button data-raw-button-ok="a carousel position dot, 8px visible with a 24px hit area"
              key={i}
              type="button"
              aria-label={t.a11y.goToSlide(i + 1)}
              onClick={() => onActiveChange(i)}
              className="relative rounded-full transition-all after:absolute after:-inset-2 after:content-['']"
              style={{ width: i === activeIndex ? activeDotWidth : 8, height: 8, background: i === activeIndex ? dotColor : 'var(--color-brand-border-strong)' }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
