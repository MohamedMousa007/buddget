'use client'

import { Check, Clock, Contrast, AlertCircle, Hourglass, type LucideIcon } from 'lucide-react'
import { isRealizedOccurrence, type IncomeOccurrence, type IncomeOccurrenceStatus } from '@/lib/utils/incomeOccurrences'

/**
 * Per-status palette. Each payday status owns a color that tints its dot and the
 * status icon inside it; selection brightens the same fill and adds a glow, so
 * the status color always stays legible. `rgb` drives the alpha tints.
 */
export const STATUS_STYLE: Record<IncomeOccurrenceStatus, { rgb: string; text: string; Icon: LucideIcon }> = {
  received: { rgb: '53,212,111', text: '#8FF0B4', Icon: Check },
  late: { rgb: '255,177,61', text: '#FFD68A', Icon: Clock },
  partial: { rgb: '125,182,255', text: '#BFD4FF', Icon: Contrast },
  missed: { rgb: '229,9,20', text: '#FF9B9B', Icon: AlertCircle },
  awaiting: { rgb: '138,138,150', text: '#C7C7D2', Icon: Hourglass },
}

const GREEN = '53,212,111'
const RED = '229,9,20'
const FAINT = 'rgba(255,255,255,.14)'

interface Props {
  occurrences: IncomeOccurrence[]
  dateLabel: (occ: IncomeOccurrence) => string
  /** Compact per-payday amount, shown below the dot when cadence leaves room (≤2 paydays). */
  amountLabel?: (occ: IncomeOccurrence) => string
  /** Status suffix appended to the date label — e.g. " (Late!)". Empty for received/awaiting. */
  statusBracket?: (occ: IncomeOccurrence) => string
  selectedKey?: string | null
  onSelect?: (occ: IncomeOccurrence) => void
}

/**
 * One timeline model for every cadence. Dots sit on a single faded-end rail: a
 * lone monthly payday centres on a full "runway", biweekly/weekly space evenly.
 * A green progress fill runs from the first payday to the last *paid* one; the
 * leading edge pulses toward the next awaiting payday (static once fully paid).
 * Each dot carries its status icon; a missed dot gets a soft red glow bracketing
 * it on the rail, faded into the surrounding green. No overflow/pointer capture
 * here — drags bubble up so the carousel swipes from anywhere.
 */
export function PaydayTimeline({ occurrences, dateLabel, amountLabel, statusBracket, selectedKey, onSelect }: Props) {
  const n = occurrences.length
  if (n === 0) return null
  const single = n === 1
  const EDGE = single ? 50 : 9
  const pos = (i: number) => (single ? 50 : EDGE + (i * (100 - 2 * EDGE)) / (n - 1))

  let lastRealized = -1
  for (let i = 0; i < n; i++) if (isRealizedOccurrence(occurrences[i])) lastRealized = i
  let nextIdx = -1
  for (let i = lastRealized + 1; i < n; i++) {
    const o = occurrences[i]
    if (!o.eventId && (o.status === 'awaiting' || o.status === 'late')) {
      nextIdx = i
      break
    }
  }

  // Green fill spans the runway/first payday up to the last paid one. The pulse
  // sweeps from the fill front (or the previous dot) toward the next awaiting one.
  const fillStart = single ? 0 : pos(0)
  const greenEnd = lastRealized >= 0 ? pos(lastRealized) : null
  const pulseFrom = lastRealized >= 0 ? pos(lastRealized) : nextIdx >= 1 ? pos(nextIdx - 1) : 0
  const pulseTo = nextIdx >= 0 ? pos(nextIdx) : null

  return (
    <div className="relative h-12">
      {/* Base rail — faded ends give every cadence a runway look. */}
      <div
        className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
        style={{
          background: FAINT,
          maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)',
          WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)',
        }}
      />
      {/* Green progress fill up to the last paid payday. */}
      {greenEnd !== null && greenEnd > fillStart ? (
        <div
          className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full"
          style={{ left: `${fillStart}%`, width: `${greenEnd - fillStart}%`, background: `rgba(${GREEN},.45)` }}
        />
      ) : null}
      {/* Red glow bracketing each missed payday, faded into the surrounding rail. */}
      {occurrences.map((o, i) =>
        o.status === 'missed' ? (
          <div
            key={`m-${o.key}`}
            className="pointer-events-none absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            style={{ left: `calc(${pos(i)}% - 7%)`, width: '14%', background: `linear-gradient(90deg, transparent, rgba(${RED},.7) 50%, transparent)` }}
          />
        ) : null,
      )}
      {/* Pulse travelling toward the next awaiting payday. */}
      {pulseTo !== null && pulseTo > pulseFrom ? (
        <div className="pointer-events-none absolute top-1/2 h-[6px] -translate-y-1/2" style={{ left: `${pulseFrom}%`, width: `${pulseTo - pulseFrom}%` }}>
          <span
            className="absolute top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full"
            style={{ background: `rgba(${GREEN},.9)`, animation: 'incomeTimelinePulse 1.8s ease-in-out infinite' }}
          />
        </div>
      ) : null}

      {/* Dots + labels. */}
      {occurrences.map((occ, i) => {
        const st = STATUS_STYLE[occ.status]
        const Icon = st.Icon
        const selected = selectedKey === occ.key
        const dimmed = !occ.actionable && !occ.eventId && !selected
        const above = single || n <= 2 ? true : i % 2 === 0
        const showAmount = Boolean(amountLabel) && n <= 2
        return (
          <button
            key={occ.key}
            type="button"
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(occ) } : undefined}
            aria-label={dateLabel(occ)}
            aria-pressed={selected}
            className={`absolute top-1/2 flex h-11 min-w-[44px] -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-opacity ${dimmed ? 'opacity-45' : ''}`}
            style={{ left: `${pos(i)}%` }}
          >
            <span
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono-numbers text-[9px] leading-none"
              style={{ [above ? 'bottom' : 'top']: 'calc(50% + 13px)', color: st.text, opacity: selected ? 1 : 0.82, fontWeight: selected ? 600 : 500 }}
              dir="ltr"
            >
              {dateLabel(occ)}
              {statusBracket ? statusBracket(occ) : ''}
            </span>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border"
              style={{
                background: `rgba(${st.rgb},${selected ? 0.5 : 0.24})`,
                borderColor: `rgba(${st.rgb},${selected ? 0.95 : 0.5})`,
                boxShadow: selected ? `0 0 0 3px rgba(${st.rgb},.2), 0 0 10px rgba(${st.rgb},.5)` : undefined,
              }}
            >
              <Icon className="h-3 w-3" strokeWidth={2.5} style={{ color: st.text }} />
            </span>
            {showAmount && amountLabel ? (
              <span
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono-numbers text-[9px] leading-none text-white/55"
                style={{ top: 'calc(50% + 13px)' }}
                dir="ltr"
              >
                {amountLabel(occ)}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
