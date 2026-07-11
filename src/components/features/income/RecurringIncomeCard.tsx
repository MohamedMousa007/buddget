'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { HERO_CARD, OCC_STATUS_COLOR } from '@/components/features/income/incomeGlass'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { IncomeSourceType } from '@/lib/store/types'

interface Props {
  sourceType?: IncomeSourceType
  name: string
  /** e.g. "Monthly · 5 · HSBC". */
  cadenceLine: string
  /** Big monthly-equivalent figure, already formatted (no currency). */
  expectedBig: string
  expectedCurrency: string
  progressPct: number
  progressLine: ReactNode
  occurrences: IncomeOccurrence[]
  chipLabel: (occ: IncomeOccurrence) => string
  /** Payday key that shows the neutral selection ring (page: tapped; assign: default/selected). */
  selectedKey?: string | null
  /** Assign select mode: green tick top-right when this card is chosen (identical to the card carousel). */
  showTick?: boolean
  onChipTap?: (occ: IncomeOccurrence) => void
  footer: ReactNode
}

/**
 * Unified recurring-income hero card. Fixed 213px height regardless of cadence —
 * the payday chip strip stays a single scrolling line and the footer slot is a
 * fixed height, so selecting a payday never reflows the card (handoff §4).
 * Presentational: the parent owns selection + footer.
 */
export function RecurringIncomeCard({
  sourceType,
  name,
  cadenceLine,
  expectedBig,
  expectedCurrency,
  progressPct,
  progressLine,
  occurrences,
  chipLabel,
  selectedKey,
  showTick,
  onChipTap,
  footer,
}: Props) {
  const colors = incomeTypeColors(sourceType)
  return (
    <div className="relative flex h-[213px] flex-col p-4 text-white" style={HERO_CARD}>
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

      {/* Payday chip strip — single scrolling line */}
      <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
        {occurrences.map((occ) => {
          const selected = selectedKey === occ.key
          const filled = occ.status !== 'awaiting'
          const dot = OCC_STATUS_COLOR[occ.status]
          return (
            <button
              key={occ.key}
              type="button"
              onClick={onChipTap ? () => onChipTap(occ) : undefined}
              className={`flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                selected
                  ? 'border-transparent bg-white/[0.08] text-white ring-2 ring-[var(--color-brand-focus)]'
                  : 'border-white/10 bg-white/[0.04] text-white/75'
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={filled ? { background: dot } : { border: `1.5px solid ${dot}` }}
              />
              <span className="font-mono-numbers">{chipLabel(occ)}</span>
            </button>
          )
        })}
      </div>

      {/* Footer (tip / CTA) — fixed-height slot so tip↔CTA swap never reflows the card. */}
      <div className="mt-auto flex h-12 items-center pt-1">{footer}</div>
    </div>
  )
}
