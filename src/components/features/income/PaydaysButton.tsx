'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'

/** Marks the header text that must never be squeezed to make room for the label. */
export const HEADER_TITLE_ATTR = 'data-header-title'

/** Icon-only is `IconButton size="md"`: 44px. */
const ICON_ONLY_W = 44

/**
 * Paydays in Flow's header. Icon + label when the row has room; icon-only (same 44px
 * height, `aria-label="Paydays"`) as soon as the label would squeeze the month, the year
 * or the arrows. Measured with a ResizeObserver rather than a breakpoint, so Arabic
 * (أيام القبض is longer) and large text sizes switch earlier on their own.
 */
export function PaydaysButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  const anchor = useRef<HTMLSpanElement>(null)
  const ghost = useRef<HTMLSpanElement>(null)
  const [iconOnly, setIconOnly] = useState(true)

  useLayoutEffect(() => {
    const row = anchor.current?.parentElement
    const title = row?.querySelector<HTMLElement>(`[${HEADER_TITLE_ATTR}]`)
    if (!row || !title || !ghost.current) return
    const measure = () => {
      const labelled = ghost.current!.getBoundingClientRect().width
      // Room the title box has beyond its own text (its children never shrink); the label
      // needs its extra width from that room.
      const kids = title.children
      const text = kids.length
        ? kids[kids.length - 1].getBoundingClientRect().right - kids[0].getBoundingClientRect().left
        : title.scrollWidth
      const slack = title.clientWidth - text
      setIconOnly((was) => {
        const extra = was ? labelled - ICON_ONLY_W : 0
        return slack < extra - 0.5
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    ro.observe(title)
    ro.observe(ghost.current)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <span ref={anchor} hidden />
      {/* Invisible twin of the labelled button: its width is what the label costs. */}
      <span ref={ghost} aria-hidden className="pointer-events-none invisible absolute -z-10 inline-flex">
        <Button variant="outline" size="touch" tabIndex={-1}>
          <CalendarClock className="size-4" strokeWidth={1.75} />
          {t.nav.paydays}
        </Button>
      </span>
      {iconOnly ? (
        <IconButton variant="outlined" size="md" aria-label={t.nav.paydays} onClick={onClick}>
          <CalendarClock className="size-[19px]" strokeWidth={1.75} />
        </IconButton>
      ) : (
        <Button variant="outline" size="touch" onClick={onClick}>
          <CalendarClock className="size-4" strokeWidth={1.75} />
          {t.nav.paydays}
        </Button>
      )}
    </>
  )
}
