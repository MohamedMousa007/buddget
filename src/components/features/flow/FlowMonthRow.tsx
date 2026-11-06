'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, format, subMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { PaydaysButton } from '@/components/features/income/PaydaysButton'
import { cycleKeyFor } from '@/lib/settings/payCycle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { navigate } from '@/lib/navigation/navigate'
import { useLocale, useT } from '@/lib/i18n'

/** How much the row gives up when it is narrow: full month + label → "Sep" + label → "Sep" + icon. */
type Fit = 'full' | 'shortMonth' | 'iconOnly'

function MonthTitle({ month, year }: { month: string; year?: string }) {
  return (
    <span className="flex items-baseline justify-center gap-1.5 whitespace-nowrap">
      <span className="text-[22px] font-bold leading-none tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{month}</span>
      {year ? <span className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{year}</span> : null}
    </span>
  )
}

/**
 * Flow's month bar, between the band and the segments: previous, the month and year, next
 * (disabled at the current month) and Paydays. Measured, not breakpointed: when everything
 * won't fit, the month drops to its 3-letter form first, then Paydays to its icon — so Arabic
 * and large text degrade on their own. While a non-month range is applied (`range`) the bar
 * names that range, the arrows are disabled and "Back to month" returns to the month.
 */
export function FlowMonthRow({ range, onBackToMonth }: { range?: string; onBackToMonth: () => void }) {
  const t = useT()
  const { locale } = useLocale()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const setMonthFilter = useSettingsStore((s) => s.setMonthFilter)
  const month = new Date(`${monthFilter}-01T00:00:00`)
  const monthStartDay = useFinanceStore((st) => st.settings.monthStartDay)
  const atCurrent = monthFilter >= cycleKeyFor(new Date(), monthStartDay)
  const fmt = (m: 'long' | 'short') => new Intl.DateTimeFormat(intlTag(locale), { month: m }).format(month)
  const longName = fmt('long')
  const shortName = fmt('short')
  const year = format(month, 'yyyy')

  const row = useRef<HTMLDivElement>(null)
  const prevBox = useRef<HTMLSpanElement>(null)
  const nextBox = useRef<HTMLSpanElement>(null)
  const ghostFull = useRef<HTMLSpanElement>(null)
  const ghostShort = useRef<HTMLSpanElement>(null)
  const ghostLabel = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState<Fit>('full')

  useLayoutEffect(() => {
    const el = row.current
    if (!el || !prevBox.current || !nextBox.current || !ghostFull.current || !ghostShort.current || !ghostLabel.current) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      // Prev, title, next, Paydays: three gaps between four items.
      const fixed = prevBox.current!.getBoundingClientRect().width + nextBox.current!.getBoundingClientRect().width + 3 * parseFloat(cs.columnGap || '0')
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
    <div ref={row} className="relative mx-4 mt-2.5 flex h-11 items-center gap-2">
      {/* Invisible twins: what each form of the title and of Paydays costs. */}
      <span aria-hidden className="pointer-events-none invisible absolute start-0 top-0 -z-10 flex h-0 flex-col items-start overflow-hidden">
        <span ref={ghostFull} className="inline-flex"><MonthTitle month={longName} year={year} /></span>
        <span ref={ghostShort} className="inline-flex"><MonthTitle month={shortName} year={year} /></span>
        <span ref={ghostLabel} className="inline-flex"><PaydaysButton onClick={() => {}} iconOnly={false} /></span>
      </span>
      <span ref={prevBox} className="shrink-0">
        <IconButton
          variant="outlined"
          size="sm"
          aria-label={t.common.previousMonth}
          disabled={range !== undefined}
          onClick={() => setMonthFilter(format(subMonths(month, 1), 'yyyy-MM'))}
        >
          <ChevronLeft className="size-[18px] rtl:rotate-180" strokeWidth={2} />
        </IconButton>
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        {range !== undefined ? (
          <span className="block truncate text-center text-[17px] font-bold leading-none text-[var(--color-brand-text-primary)]">{range}</span>
        ) : (
          <MonthTitle month={fit === 'full' ? longName : shortName} year={year} />
        )}
      </div>
      <span ref={nextBox} className="shrink-0">
        <IconButton
          variant="outlined"
          size="sm"
          aria-label={t.common.nextMonth}
          disabled={atCurrent || range !== undefined}
          onClick={() => setMonthFilter(format(addMonths(month, 1), 'yyyy-MM'))}
        >
          <ChevronRight className="size-[18px] rtl:rotate-180" strokeWidth={2} />
        </IconButton>
      </span>
      {range !== undefined ? (
        <Button variant="outline" size="touch" onClick={onBackToMonth}>
          {t.flow.backToMonth}
        </Button>
      ) : (
        <PaydaysButton onClick={() => navigate('/paydays')} iconOnly={fit === 'iconOnly'} />
      )}
    </div>
  )
}
