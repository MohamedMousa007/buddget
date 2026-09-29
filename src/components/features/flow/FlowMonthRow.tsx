'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, format, subMonths } from 'date-fns'
import { IconButton } from '@/components/ui/IconButton'
import { PaydaysButton } from '@/components/features/income/PaydaysButton'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { navigate } from '@/lib/navigation/navigate'
import { useLocale, useT } from '@/lib/i18n'

/** How much the row gives up when it is narrow: full month + label → "Sep" + label → "Sep" + icon. */
type Fit = 'full' | 'shortMonth' | 'iconOnly'

function MonthTitle({ month, year }: { month: string; year: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-2xl font-bold tracking-[-0.02em] text-[var(--flow-band-fg)]">{month}</span>
      <span className="font-mono-numbers text-[13px] text-[var(--flow-band-fg-2)]">{year}</span>
    </span>
  )
}

/**
 * The top row of Flow's band: the month and year, Paydays, and the month arrows, on the teal.
 * Measured, not breakpointed: when everything won't fit, the month drops to its 3-letter
 * form first, then Paydays to its icon — so Arabic and large text degrade on their own.
 */
export function FlowMonthRow() {
  const t = useT()
  const { locale } = useLocale()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const setMonthFilter = useSettingsStore((s) => s.setMonthFilter)
  const month = new Date(`${monthFilter}-01T00:00:00`)
  const atCurrent = monthFilter >= format(new Date(), 'yyyy-MM')
  const fmt = (m: 'long' | 'short') => new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', { month: m }).format(month)
  const longName = fmt('long')
  const shortName = fmt('short')
  const year = format(month, 'yyyy')

  const row = useRef<HTMLDivElement>(null)
  const arrows = useRef<HTMLDivElement>(null)
  const ghostFull = useRef<HTMLSpanElement>(null)
  const ghostShort = useRef<HTMLSpanElement>(null)
  const ghostLabel = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState<Fit>('full')

  useLayoutEffect(() => {
    const el = row.current
    if (!el || !arrows.current || !ghostFull.current || !ghostShort.current || !ghostLabel.current) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      // Title, Paydays, arrows: two gaps between three items.
      const fixed = arrows.current!.getBoundingClientRect().width + 2 * parseFloat(cs.columnGap || '0')
      const w = (r: React.RefObject<HTMLSpanElement | null>) => r.current!.getBoundingClientRect().width
      const fits = (title: number, paydays: number) => title + paydays + fixed <= avail
      setFit(fits(w(ghostFull), w(ghostLabel)) ? 'full' : fits(w(ghostShort), w(ghostLabel)) ? 'shortMonth' : 'iconOnly')
    }
    measure()
    // The ghosts change size when the web font lands or the text size changes; the row when the screen does.
    const ro = new ResizeObserver(measure)
    for (const node of [el, ghostFull.current, ghostShort.current, ghostLabel.current]) ro.observe(node)
    let live = true
    void document.fonts?.ready.then(() => live && measure())
    return () => {
      live = false
      ro.disconnect()
    }
  }, [longName, shortName, locale])

  return (
    <div ref={row} className="relative flex min-h-14 items-center gap-1 pe-3 ps-[18px] pt-1.5">
      {/* Invisible twins: what each form of the title and of Paydays costs. */}
      <span aria-hidden className="pointer-events-none invisible absolute start-0 top-0 -z-10 flex h-0 flex-col items-start overflow-hidden">
        <span ref={ghostFull} className="inline-flex"><MonthTitle month={longName} year={year} /></span>
        <span ref={ghostShort} className="inline-flex"><MonthTitle month={shortName} year={year} /></span>
        <span ref={ghostLabel} className="inline-flex"><PaydaysButton onClick={() => {}} iconOnly={false} onBand /></span>
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <MonthTitle month={fit === 'full' ? longName : shortName} year={year} />
      </div>
      <PaydaysButton onClick={() => navigate('/paydays')} iconOnly={fit === 'iconOnly'} onBand />
      <div ref={arrows} className="flex shrink-0 items-center gap-0.5">
        <IconButton variant="onBandGhost" size="sm" aria-label={t.common.previousMonth} onClick={() => setMonthFilter(format(subMonths(month, 1), 'yyyy-MM'))}>
          <ChevronLeft className="size-[18px]" strokeWidth={2} />
        </IconButton>
        <IconButton
          variant="onBandGhost"
          size="sm"
          aria-label={t.common.nextMonth}
          disabled={atCurrent}
          onClick={() => setMonthFilter(format(addMonths(month, 1), 'yyyy-MM'))}
        >
          <ChevronRight className="size-[18px]" strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  )
}
