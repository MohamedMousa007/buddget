'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, X, Search } from 'lucide-react'
import { useLocale } from '@/lib/i18n'

const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WD_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const WDL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WDL_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const YEARS = Array.from({ length: 2035 - 1970 + 1 }, (_, i) => 1970 + i)

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
    ? `${WDL_AR[dow]}، ${p.d} ${MON_AR[p.m]}`
    : `${WDL[dow]}, ${p.d} ${MONS[p.m]}`
}

export interface UnifiedDatePickerProps {
  open: boolean
  /** Currently selected date as ISO `yyyy-mm-dd`. */
  value: string
  onConfirm: (iso: string) => void
  onClose: () => void
}

/**
 * App-wide date picker: a centered popup with a red header, a constant-size
 * 6-row day grid (adjacent-month days for a fixed frame), a month grid, and a
 * searchable year dropdown. Day-only — timestamps are set server-side. Tapping a
 * day confirms and closes instantly.
 */
export function UnifiedDatePicker({ open, value, onConfirm, onClose }: UnifiedDatePickerProps) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const sel = useMemo(() => parseSeed(value), [value])
  const today = useMemo(() => todayYMD(), [])
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const [view, setView] = useState({ y: sel.y, m: sel.m })
  const [yearQuery, setYearQuery] = useState('')

  if (!open) return null

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
  const first = new Date(y, m, 1).getDay()
  const dim = new Date(y, m + 1, 0).getDate()
  const prevDim = new Date(y, m, 0).getDate()
  const prevM = m === 0 ? 11 : m - 1
  const prevY = m === 0 ? y - 1 : y
  const nextM = m === 11 ? 0 : m + 1
  const nextY = m === 11 ? y + 1 : y
  const raw: (YMD & { out: boolean })[] = []
  for (let i = first - 1; i >= 0; i--) raw.push({ d: prevDim - i, y: prevY, m: prevM, out: true })
  for (let d = 1; d <= dim; d++) raw.push({ d, y, m, out: false })
  for (let nd = 1; raw.length < 42; nd++) raw.push({ d: nd, y: nextY, m: nextM, out: true })

  const q = yearQuery.trim()
  const yearList = q ? YEARS.filter((yr) => String(yr).includes(q)) : YEARS

  const activePill =
    'inline-flex items-center gap-1 px-2.5 py-[5px] rounded-[9px] cursor-pointer border text-white'
  const monthPill = `${activePill} font-bold text-[14.5px] border-white/30 ${
    isMonths ? 'bg-white/30' : 'bg-white/15'
  }`
  const yearPill = `${activePill} font-bold text-[14.5px] font-mono-numbers border-white/30 ${
    isYears ? 'bg-white/30' : 'bg-white/15'
  }`
  const headerBtn =
    'w-[27px] h-[27px] flex items-center justify-center border-none rounded-[9px] text-white cursor-pointer bg-white/[0.16] hover:bg-white/30'

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[130] flex items-center justify-center p-[22px]"
      style={{ animation: 'efFade .16s ease' }}
    >
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/[0.62] border-none cursor-default"
      />
      <div
        className="relative w-full max-w-[300px] overflow-hidden rounded-[22px] border border-[#2E2E3C] bg-[#12121b] text-white"
        style={{
          boxShadow: '0 26px 64px -14px rgba(0,0,0,.7)',
          fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
          animation: 'efPop .22s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* header bar */}
        <div
          className="flex items-center justify-between px-[13px] pt-[11px] pb-[10px]"
          style={{
            background: 'linear-gradient(160deg,#F40612,#C5070F)',
            boxShadow: '0 6px 18px -8px rgba(229,9,20,.6)',
          }}
        >
          <div className="flex items-center gap-[7px]">
            <button type="button" onClick={() => setModeToggle('months')} className={monthPill}>
              <span className="whitespace-nowrap">{ar ? MON_AR[m] : MONS[m]}</span>
              <ChevronDown
                className="w-3.5 h-3.5 text-white/80 transition-transform"
                style={{ transform: isMonths ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            <button type="button" onClick={() => setModeToggle('years')} className={yearPill}>
              <span>{y}</span>
              <ChevronDown
                className="w-3.5 h-3.5 text-white/80 transition-transform"
                style={{ transform: isYears ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
          </div>
          <div className="flex items-center gap-[5px]">
            {!isYears ? (
              <>
                <button
                  type="button"
                  onClick={() => (isMonths ? shiftYear(-1) : shiftMonth(-1))}
                  className={headerBtn}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => (isMonths ? shiftYear(1) : shiftMonth(1))}
                  className={headerBtn}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : null}
            <button type="button" onClick={onClose} className={`${headerBtn} ms-[2px]`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* content region — constant height */}
        <div className="h-[230px] px-[13px] pt-[9px] pb-[13px]">
          {isDays ? (
            <div>
              <div className="grid grid-cols-7 mb-1.5">
                {(ar ? WD_AR : WD).map((w, i) => (
                  <div
                    key={i}
                    className="text-center text-[10px] font-bold tracking-[.04em] text-[#7C7C92] py-px"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 grid-rows-6 gap-[2px] h-[186px]">
                {raw.map((c, i) => {
                  const isSel = sel.y === c.y && sel.m === c.m && sel.d === c.d
                  const isToday = today.y === c.y && today.m === c.m && today.d === c.d
                  const bg = isSel
                    ? 'bg-[#E50914] text-white'
                    : isToday
                      ? 'bg-[rgba(229,9,20,.12)] text-[#FF6B6B]'
                      : c.out
                        ? 'text-[#4B4B58]'
                        : 'text-[#E8E8F0]'
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pick(c)}
                      className={`relative flex items-center justify-center rounded-[10px] cursor-pointer text-[13px] font-semibold border-none transition-colors ${bg}`}
                      style={isSel ? { boxShadow: '0 4px 12px rgba(229,9,20,.4)' } : undefined}
                    >
                      {c.d}
                      {isToday && !isSel ? (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF3B44]" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {isMonths ? (
            <div className="grid grid-cols-3 grid-rows-4 gap-[9px] h-full">
              {(ar ? MON_AR : MONS).map((lbl, i) => {
                const isCur = i === m
                const isTM = i === today.m && y === today.y
                const cls = isCur
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : isTM
                    ? 'bg-[rgba(229,9,20,.1)] text-[#FF7A82] border-[rgba(229,9,20,.45)]'
                    : 'bg-[#1B1B26] text-[#D6D6E2] border-[#2A2A38]'
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setView({ y, m: i })
                      setMode('days')
                    }}
                    className={`flex items-center justify-center rounded-[12px] cursor-pointer text-sm font-semibold border transition-colors ${cls}`}
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
                <span className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 inline-flex text-[#8A8AA0]">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  value={yearQuery}
                  onChange={(e) => setYearQuery(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder={ar ? 'اكتب سنة…' : 'Type a year…'}
                  className="w-full h-[38px] rounded-[11px] border border-[#2E2E3C] bg-[#1A1A24] ps-[34px] pe-3.5 text-white text-sm font-semibold font-mono-numbers text-start placeholder:text-[#5A5A72] focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 content-start [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {yearList.map((yr) => {
                  const on = yr === y
                  const isTY = yr === today.y
                  const cls = on
                    ? 'bg-[#E50914] text-white border-[#E50914]'
                    : isTY
                      ? 'bg-[rgba(229,9,20,.1)] text-[#FF7A82] border-[rgba(229,9,20,.4)]'
                      : 'bg-[#1B1B26] text-[#D6D6E2] border-[#2A2A38]'
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setView({ y: yr, m })
                        setMode('days')
                        setYearQuery('')
                      }}
                      className={`h-10 flex items-center justify-center rounded-[10px] cursor-pointer text-sm font-semibold font-mono-numbers border transition-colors ${cls}`}
                    >
                      {yr}
                    </button>
                  )
                })}
                {yearList.length === 0 ? (
                  <div className="col-span-3 text-center py-[22px] text-[#5A5A72] text-[13px] font-medium">
                    {ar ? 'لا توجد سنة مطابقة' : 'No matching year'}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
