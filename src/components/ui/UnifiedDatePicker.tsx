'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight, X, Search } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { buildMonthGrid, pickerBounds, pickerYears, weekdayColumns } from '@/lib/time/monthGrid'
import { monthNames, weekdayNames } from '@/lib/i18n/dateFormat'
import { useWeekStart } from '@/hooks/useWeekStart'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { toLatinDigits } from '@/lib/utils/formatters'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { Scrim } from '@/components/ui/Scrim'
import { IconButton } from '@/components/ui/IconButton'

interface YMD {
  y: number
  m: number
  d: number
}

function toISO({ y, m, d }: YMD): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseISO(iso: string): YMD {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: (m || 1) - 1, d: d || 1 }
}

/** Parse an ISO date, falling back to today for empty / partial (`yyyy-mm`) values. */
function parseSeed(value: string): YMD {
  if (value && /^\d{4}-\d{2}(-\d{2})?/.test(value)) return parseISO(value)
  return todayYMD()
}

function todayYMD(): YMD {
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }
}

/** Friendly pill label for a date: "Today", else "Sun, 12 Jul" (en) / "الأحد، ١٢ يوليو" wording without index shift (ar). */
export function formatDatePillLabel(iso: string, locale: 'en' | 'ar', todayLabel: string): string {
  const t = todayYMD()
  const p = parseISO(iso)
  if (p.y === t.y && p.m === t.m && p.d === t.d) return todayLabel
  const dow = new Date(p.y, p.m, p.d).getDay()
  return locale === 'ar'
    ? `${weekdayNames('ar', 'long')[dow]}، ${p.d} ${monthNames('ar')[p.m]}`
    : `${weekdayNames('en', 'short')[dow]}, ${p.d} ${monthNames('en', 'short')[p.m]}`
}

export interface UnifiedDatePickerProps {
  open: boolean
  /** Currently selected date as ISO `yyyy-mm-dd`. */
  value: string
  onConfirm: (iso: string) => void
  onClose: () => void
  /** Earliest / latest selectable day (ISO). Default: the year list's span, 1970 to 50 years ahead. */
  min?: string
  max?: string
}

/**
 * App-wide date picker: a centered popup with a teal header, a constant-size
 * 6-row day grid (adjacent-month days for a fixed frame), a month grid, and a
 * searchable year dropdown. Day-only — timestamps are set server-side. Tapping a
 * day confirms and closes instantly.
 */
export function UnifiedDatePicker({ open, value, onConfirm, onClose, min, max }: UnifiedDatePickerProps) {
  const { locale } = useLocale()
  const t = useT()
  const ar = locale === 'ar'
  const sel = useMemo(() => parseSeed(value), [value])
  const today = useMemo(() => todayYMD(), [])
  const weekStart = useWeekStart()
  const years = useMemo(() => pickerYears(), [])
  const bounds = useMemo(() => ({ ...pickerBounds(), ...(min ? { min } : {}), ...(max ? { max } : {}) }), [min, max])
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const [view, setView] = useState({ y: sel.y, m: sel.m })
  const [yearQuery, setYearQuery] = useState('')
  const selYearRef = useRef<HTMLButtonElement>(null)

  // Land the year grid on the selected year (recent/current by default, or the
  // birthdate year when editing one) instead of scrolling from 1970.
  useEffect(() => {
    if (mode === 'years') selYearRef.current?.scrollIntoView({ block: 'center' })
  }, [mode])

  // Lock background scroll while open (issue 5).
  useScrollLock(open)
  useEscapeClose(open, onClose)

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    return registerBackGuard(() => {
      onCloseRef.current()
      return true
    })
  }, [open])

  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const { y, m } = view
  const isDays = mode === 'days'
  const isMonths = mode === 'months'
  const isYears = mode === 'years'

  const setModeToggle = (next: 'months' | 'years') => {
    setMode((cur) => (cur === next ? 'days' : next))
    setYearQuery('')
  }
  const shiftMonth = (delta: number) => {
    let nm = m + delta
    let ny = y
    if (nm < 0) {
      nm = 11
      ny -= 1
    }
    if (nm > 11) {
      nm = 0
      ny += 1
    }
    setView({ y: ny, m: nm })
  }
  const shiftYear = (delta: number) => setView({ y: y + delta, m })

  const pick = (c: YMD) => {
    onConfirm(toISO(c))
    onClose()
  }

  // 6-row (42-cell) grid with leading/trailing adjacent-month days.
  const raw = buildMonthGrid(y, m, weekStart)
  const monthLabels = monthNames(locale, 'short')
  const weekdayLabels = weekdayNames(locale, 'narrow')

  const q = yearQuery.trim()
  const yearList = q ? years.filter((yr) => String(yr).includes(q)) : years

  const activePill =
    'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md cursor-pointer border text-[var(--flow-band-fg)] border-[var(--flow-band-mix)]'
  const monthPill = `${activePill} font-bold text-sm ${
    isMonths ? 'bg-[var(--flow-band-mix)]' : 'bg-[color-mix(in_oklab,var(--flow-band-fg)_12%,transparent)]'
  }`
  const yearPill = `${activePill} font-bold text-sm font-mono-numbers ${
    isYears ? 'bg-[var(--flow-band-mix)]' : 'bg-[color-mix(in_oklab,var(--flow-band-fg)_12%,transparent)]'
  }`

  // Portal to <body> so `fixed` isn't trapped by a transformed ancestor when the
  // picker opens from inside a form sheet (same class as the currency-sheet bug).
  return createPortal(
    <div
      dir={ar ? 'rtl' : 'ltr'}
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.common.selectDate}
      tabIndex={-1}
      className="fixed inset-0 z-[var(--z-picker)] flex items-center justify-center p-6 outline-none"
      style={{ animation: 'efFade .16s ease' }}
    >
      <Scrim label={t.common.close} onClick={onClose} tone="heavy" blur={false} />
      <div
        className="relative w-full max-w-72 md:max-w-80 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)]"
        style={{
          boxShadow: '0 26px 64px -14px rgba(0,0,0,.4)',
          fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
          animation: 'efPop .22s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* header bar */}
        <div
          className="flex items-center justify-between px-3.5 pt-3 pb-2.5"
          style={{
            background: 'linear-gradient(160deg, var(--flow-band-b), var(--flow-band-a))',
            boxShadow: '0 6px 18px -8px color-mix(in oklab, var(--color-brand-primary) 60%, transparent)',
          }}
        >
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setModeToggle('months')} className={monthPill}>
              <span className="whitespace-nowrap">{monthLabels[m]}</span>
              <ChevronDown
                className="w-3.5 h-3.5 opacity-80 transition-transform"
                style={{ transform: isMonths ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            <button type="button" onClick={() => setModeToggle('years')} className={yearPill}>
              <span>{y}</span>
              <ChevronDown
                className="w-3.5 h-3.5 opacity-80 transition-transform"
                style={{ transform: isYears ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {!isYears ? (
              <>
                <IconButton
                  aria-label={t.a11y.previous}
                  variant="onBand"
                  size="sm"
                  onClick={() => (isMonths ? shiftYear(-1) : shiftMonth(-1))}
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  aria-label={t.common.next}
                  variant="onBand"
                  size="sm"
                  onClick={() => (isMonths ? shiftYear(1) : shiftMonth(1))}
                >
                  <ChevronRight />
                </IconButton>
              </>
            ) : null}
            <IconButton
              aria-label={t.common.close}
              variant="onBand"
              size="sm"
              onClick={onClose}
              className="ms-0.5"
            >
              <X />
            </IconButton>
          </div>
        </div>

        {/* content region — constant height */}
        <div className="h-56 px-3.5 pt-2.5 pb-3.5">
          {isDays ? (
            <div>
              <div className="grid grid-cols-7 mb-1.5">
                {weekdayColumns(weekStart).map((dow, i) => (
                  <div
                    key={i}
                    className="text-center text-[0.625rem] font-bold tracking-[.04em] text-[var(--color-brand-text-muted)] py-px"
                  >
                    {weekdayLabels[dow]}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 grid-rows-6 gap-0.5 h-48">
                {raw.map((c, i) => {
                  const outOfRange = toISO(c) < bounds.min || toISO(c) > bounds.max
                  const isSel = sel.y === c.y && sel.m === c.m && sel.d === c.d
                  const isToday = today.y === c.y && today.m === c.m && today.d === c.d
                  const bg = isSel
                    ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
                    : isToday
                      ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]'
                      : c.out
                        ? 'text-[var(--color-brand-text-muted)]'
                        : 'text-[var(--color-brand-text-primary)]'
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={outOfRange}
                      onClick={() => pick(c)}
                      className={`relative flex items-center justify-center rounded-md cursor-pointer text-sm font-semibold border-none transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${bg}`}
                      style={isSel ? { boxShadow: '0 4px 12px color-mix(in oklab, var(--color-brand-primary) 40%, transparent)' } : undefined}
                    >
                      {c.d}
                      {isToday && !isSel ? (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-brand-primary)]" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {isMonths ? (
            <div className="grid grid-cols-3 grid-rows-4 gap-2.5 h-full">
              {monthLabels.map((lbl, i) => {
                const isCur = i === m
                const isTM = i === today.m && y === today.y
                const cls = isCur
                  ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] border-[var(--color-brand-primary)]'
                  : isTM
                    ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)] border-[var(--color-brand-primary)]/45'
                    : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] border-[var(--color-brand-border)]'
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setView({ y, m: i })
                      setMode('days')
                    }}
                    className={`flex items-center justify-center rounded-lg cursor-pointer text-sm font-semibold border transition-colors ${cls}`}
                  >
                    {lbl}
                  </button>
                )
              })}
            </div>
          ) : null}

          {isYears ? (
            <div className="flex flex-col h-full">
              <div className="relative mb-2.5 shrink-0">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 inline-flex text-[var(--color-brand-text-muted)]">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  value={yearQuery}
                  aria-label={t.inlineCopy.yearPicker.typeYear}
                  onChange={(e) => setYearQuery(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder={t.inlineCopy.yearPicker.typeYear}
                  className="w-full h-10 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] ps-9 pe-3.5 text-[var(--color-brand-text-primary)] text-sm font-semibold font-mono-numbers text-start placeholder:text-[var(--color-brand-text-muted)] focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 content-start [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {yearList.map((yr) => {
                  const on = yr === y
                  const isTY = yr === today.y
                  const cls = on
                    ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] border-[var(--color-brand-primary)]'
                    : isTY
                      ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)] border-[var(--color-brand-primary)]/40'
                      : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] border-[var(--color-brand-border)]'
                  return (
                    <button
                      key={yr}
                      ref={on ? selYearRef : undefined}
                      type="button"
                      onClick={() => {
                        setView({ y: yr, m })
                        setMode('days')
                        setYearQuery('')
                      }}
                      className={`h-10 flex items-center justify-center rounded-md cursor-pointer text-sm font-semibold font-mono-numbers border transition-colors ${cls}`}
                    >
                      {yr}
                    </button>
                  )
                })}
                {yearList.length === 0 ? (
                  <div className="col-span-3 text-center py-6 text-[var(--color-brand-text-muted)] text-sm font-medium">
                    {t.inlineCopy.yearPicker.noMatch}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
