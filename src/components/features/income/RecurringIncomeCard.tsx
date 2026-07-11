'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { heroCardStyle, OCC_STATUS_COLOR } from '@/components/features/income/incomeGlass'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { IncomeSourceType } from '@/lib/store/types'

interface Props {
  sourceType?: IncomeSourceType
  name: string
  /** First sub-line: e.g. "Monthly · 5". Cadence only — payment goes on its own line. */
  cadenceLine: string
  /** Second sub-line: the payment method, abbreviated (glyph + last4 / label). */
  paymentLine?: ReactNode
  /** Big monthly-equivalent figure, already formatted (no currency). */
  expectedBig: string
  expectedCurrency: string
  progressPct: number
  progressLine: ReactNode
  occurrences: IncomeOccurrence[]
  chipLabel: (occ: IncomeOccurrence) => string
  /** Compact per-payday amount shown in the badge when cadence leaves room (≤2 paydays). */
  amountLabel?: (occ: IncomeOccurrence) => string
  /** Payday key that shows the neutral selection highlight (page: tapped; assign: default/selected). */
  selectedKey?: string | null
  /** Assign select mode: green tick top-right when this card is chosen (identical to the card carousel). */
  showTick?: boolean
  onChipTap?: (occ: IncomeOccurrence) => void
  footer: ReactNode
}

const isReceived = (s: IncomeOccurrence['status']) => s === 'received' || s === 'late'

/**
 * Unified recurring-income hero card. Fixed 213px height regardless of cadence —
 * the payday strip adapts to frequency (monthly: one full-width row; biweekly:
 * two badges with amounts; weekly: scrolling date pills) without ever reflowing
 * the card. Presentational: the parent owns selection + footer.
 */
export function RecurringIncomeCard({
  sourceType,
  name,
  cadenceLine,
  paymentLine,
  expectedBig,
  expectedCurrency,
  progressPct,
  progressLine,
  occurrences,
  chipLabel,
  amountLabel,
  selectedKey,
  showTick,
  onChipTap,
  footer,
}: Props) {
  const colors = incomeTypeColors(sourceType)
  const single = occurrences.length === 1
  const withAmount = occurrences.length <= 2

  return (
    <div className="relative flex h-[213px] flex-col p-4 text-white" style={heroCardStyle(colors.fg)}>
      {showTick ? (
        <span className="absolute end-3 top-3 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#38D96B] text-white shadow-[0_2px_6px_rgba(0,0,0,.25)]">
          <Check className="h-[14px] w-[14px]" strokeWidth={3} />
        </span>
      ) : null}

      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: colors.bg, color: colors.fg }}
        >
          <IncomeTypeIcon type={sourceType} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{name}</p>
          <p className="mt-0.5 truncate font-mono-numbers text-[11px] leading-tight text-white/65">{cadenceLine}</p>
          {paymentLine ? (
            <div className="mt-1 flex items-center gap-1.5 truncate text-[11px] leading-tight text-white/55">{paymentLine}</div>
          ) : null}
        </div>
        <div className={`max-w-[38%] shrink-0 text-end ${showTick ? 'me-8' : ''}`}>
          <p className="truncate font-mono-numbers text-base font-bold leading-none tracking-[-0.5px]">
            {expectedBig} <span className="text-[10px] font-medium text-white/55">{expectedCurrency}</span>
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/55">Expected / mo</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#35D46F] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
          />
        </div>
        <p className="mt-1.5 truncate font-mono-numbers text-[11px] text-white/70">{progressLine}</p>
      </div>

      {/* Payday strip — adapts to cadence. Single monthly payday fills the width. */}
      <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
        {occurrences.map((occ) => {
          const selected = selectedKey === occ.key
          const received = isReceived(occ.status)
          const filled = occ.status !== 'awaiting'
          const dot = OCC_STATUS_COLOR[occ.status]
          const tone = received
            ? 'border-[rgba(53,212,111,0.4)] bg-[rgba(53,212,111,0.16)] text-[#8FF0B4]'
            : selected
              ? 'border-transparent bg-white/[0.14] text-white'
              : 'border-white/10 bg-white/[0.04] text-white/75'
          return (
            <button
              key={occ.key}
              type="button"
              onClick={onChipTap ? () => onChipTap(occ) : undefined}
              className={`flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${single ? 'w-full justify-start' : ''} ${tone}`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={filled ? { background: dot } : { border: `1.5px solid ${dot}` }}
              />
              <span className="font-mono-numbers">{chipLabel(occ)}</span>
              {withAmount && amountLabel ? (
                <>
                  <span className="text-white/35">·</span>
                  <span className="truncate font-mono-numbers text-white/60">{amountLabel(occ)}</span>
                </>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Footer (tip / CTA) — fixed-height slot so tip↔CTA swap never reflows the card. */}
      <div className="mt-auto flex h-12 items-center pt-1">{footer}</div>
    </div>
  )
}
