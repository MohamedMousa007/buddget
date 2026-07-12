'use client'

import { Fragment } from 'react'
import { Check, Clock, Contrast, AlertCircle, Hourglass, type LucideIcon } from 'lucide-react'
import { REALIZED_STATUSES, type IncomeOccurrence, type IncomeOccurrenceStatus } from '@/lib/utils/incomeOccurrences'

/**
 * Per-status palette. Each payday status owns a color that tints its dot/pill;
 * selection brightens the same fill and adds a glow, so the status color always
 * stays legible. `rgb` drives the alpha tints.
 */
export const STATUS_STYLE: Record<IncomeOccurrenceStatus, { rgb: string; text: string; Icon: LucideIcon }> = {
  received: { rgb: '53,212,111', text: '#8FF0B4', Icon: Check },
  late: { rgb: '255,177,61', text: '#FFD68A', Icon: Clock },
  partial: { rgb: '125,182,255', text: '#BFD4FF', Icon: Contrast },
  missed: { rgb: '229,9,20', text: '#FF9B9B', Icon: AlertCircle },
  awaiting: { rgb: '138,138,150', text: '#C7C7D2', Icon: Hourglass },
}

interface Props {
  occurrences: IncomeOccurrence[]
  dateLabel: (occ: IncomeOccurrence) => string
  /** Compact per-payday amount, shown inline when cadence leaves room (≤2 paydays). */
  amountLabel?: (occ: IncomeOccurrence) => string
  selectedKey?: string | null
  onSelect?: (occ: IncomeOccurrence) => void
}

/**
 * Payday strip for the recurring card. ≤2 paydays render as wide status pills
 * with inline amounts; 3+ render as a connected dot timeline (dates alternating
 * above/below, no horizontal scroll ever) with a pulse travelling along the
 * connector from the latest received payday to the next one. No pointer capture
 * or overflow here — drags bubble up so the carousel swipes from anywhere.
 */
export function PaydayTimeline({ occurrences, dateLabel, amountLabel, selectedKey, onSelect }: Props) {
  if (occurrences.length <= 2) {
    return <PillRow occurrences={occurrences} dateLabel={dateLabel} amountLabel={amountLabel} selectedKey={selectedKey} onSelect={onSelect} />
  }

  const realized = (o: IncomeOccurrence) => Boolean(o.eventId) && REALIZED_STATUSES.has(o.status)
  let pulseFrom = -1
  for (let i = 0; i < occurrences.length; i++) if (realized(occurrences[i])) pulseFrom = i
  const pulseTo = pulseFrom >= 0 && pulseFrom + 1 < occurrences.length && !occurrences[pulseFrom + 1].eventId ? pulseFrom + 1 : -1

  return (
    <div className="flex h-10 items-center">
      {occurrences.map((occ, i) => {
        const st = STATUS_STYLE[occ.status]
        const selected = selectedKey === occ.key
        const dimmed = !occ.actionable && !occ.eventId && !selected
        const prev = occurrences[i - 1]
        const segmentDone = i > 0 && realized(prev) && realized(occ)
        const pulses = i > 0 && i - 1 === pulseFrom && i === pulseTo
        return (
          <Fragment key={occ.key}>
            {i > 0 ? (
              <div className="relative h-[2px] min-w-3 flex-1 rounded-full" style={{ background: segmentDone ? 'rgba(53,212,111,.4)' : 'rgba(255,255,255,.14)' }}>
                {pulses ? (
                  <span
                    className="absolute top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full"
                    style={{ background: `rgba(${STATUS_STYLE.received.rgb},.9)`, animation: 'incomeTimelinePulse 1.8s ease-in-out infinite' }}
                  />
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSelect ? () => onSelect(occ) : undefined}
              aria-label={dateLabel(occ)}
              aria-pressed={selected}
              // -my-1 grows the hit area to 44px+ without growing the 40px visual block.
              className={`relative -my-1 flex h-12 min-w-[44px] flex-col items-center justify-center transition-opacity ${dimmed ? 'opacity-45' : ''}`}
            >
              <span
                className={`absolute font-mono-numbers text-[9px] leading-none ${i % 2 === 0 ? 'top-0.5' : 'bottom-0.5'}`}
                style={{ left: '50%', transform: 'translateX(-50%)', color: selected ? st.text : 'rgba(255,255,255,.6)', whiteSpace: 'nowrap' }}
                dir="ltr"
              >
                {dateLabel(occ)}
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full border transition-shadow"
                style={{
                  background: `rgba(${st.rgb},${selected ? 0.55 : 0.28})`,
                  borderColor: `rgba(${st.rgb},${selected ? 0.95 : 0.55})`,
                  boxShadow: selected ? `0 0 0 3px rgba(${st.rgb},.22), 0 0 10px rgba(${st.rgb},.55)` : undefined,
                }}
              />
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

function PillRow({ occurrences, dateLabel, amountLabel, selectedKey, onSelect }: Props) {
  const single = occurrences.length === 1
  return (
    <div className="flex gap-2">
      {occurrences.map((occ) => {
        const selected = selectedKey === occ.key
        const st = STATUS_STYLE[occ.status]
        const StatusIcon = st.Icon
        const dimmed = !occ.actionable && !occ.eventId && !selected
        return (
          <button
            key={occ.key}
            type="button"
            onClick={onSelect ? () => onSelect(occ) : undefined}
            className={`flex min-h-[30px] min-w-0 flex-1 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${single ? 'justify-start' : ''} ${dimmed ? 'opacity-45' : ''}`}
            style={{
              background: `rgba(${st.rgb},${selected ? 0.3 : 0.14})`,
              borderColor: `rgba(${st.rgb},${selected ? 0.65 : 0.32})`,
              color: st.text,
              boxShadow: selected ? `0 0 8px rgba(${st.rgb},.35)` : undefined,
            }}
          >
            <StatusIcon className="h-3 w-3 shrink-0" />
            <span className="font-mono-numbers">{dateLabel(occ)}</span>
            {amountLabel ? (
              single ? (
                <span className="ms-auto truncate font-mono-numbers opacity-80">{amountLabel(occ)}</span>
              ) : (
                <>
                  <span className="opacity-40">·</span>
                  <span className="truncate font-mono-numbers opacity-75">{amountLabel(occ)}</span>
                </>
              )
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
