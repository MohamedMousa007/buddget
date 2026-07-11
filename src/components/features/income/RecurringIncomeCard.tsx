'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { GLASS_CARD, OCC_STATUS_COLOR } from '@/components/features/income/incomeGlass'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { IncomeSourceType } from '@/lib/store/types'

interface Props {
  sourceType?: IncomeSourceType
  name: string
  /** e.g. "Monthly · day 5 · HSBC". */
  cadenceLine: string
  /** Big monthly-equivalent figure, already formatted (no currency). */
  expectedBig: string
  expectedCurrency: string
  /** e.g. "≈ $848". */
  expectedSecondary?: string | null
  progressPct: number
  progressLine: ReactNode
  occurrences: IncomeOccurrence[]
  chipLabel: (occ: IncomeOccurrence) => string
  selectedKey?: string | null
  /** Payday key that pulses with the next-awaiting green glow (assign default). */
  glowKey?: string | null
  /** Assign select mode: green tick top-right when this card is chosen. */
  showTick?: boolean
  onChipTap?: (occ: IncomeOccurrence) => void
  footer: ReactNode
}

/**
 * Unified recurring-income hero card. Fixed 213px height regardless of cadence —
 * the payday chip strip stays a single scrolling line so every card matches
 * (handoff §4). Presentational: the parent owns selection + footer.
 */
export function RecurringIncomeCard({
  sourceType,
  name,
  cadenceLine,
  expectedBig,
  expectedCurrency,
  expectedSecondary,
  progressPct,
  progressLine,
  occurrences,
  chipLabel,
  selectedKey,
  glowKey,
  showTick,
  onChipTap,
  footer,
}: Props) {
  const colors = incomeTypeColors(sourceType)
  return (
    <div className="relative flex h-[213px] flex-col p-4 text-white" style={GLASS_CARD}>
      {showTick ? (
        <span className="absolute end-3 top-3 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#35D46F] text-[#04140a]">
          <Check className="h-4 w-4" strokeWidth={3} />
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
          <p className="mt-0.5 truncate font-mono-numbers text-[11px] leading-tight text-white/55">{cadenceLine}</p>
        </div>
        <div className={`shrink-0 text-end ${showTick ? 'me-8' : ''}`}>
          <p className="font-mono-numbers text-lg font-bold leading-none tracking-[-0.5px]">
            {expectedBig} <span className="text-[10px] font-medium text-white/50">{expectedCurrency}</span>
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/45">Expected / mo</p>
          {expectedSecondary ? (
            <p className="mt-0.5 font-mono-numbers text-[10px] text-white/45">{expectedSecondary}</p>
          ) : null}
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
        <p className="mt-1.5 truncate font-mono-numbers text-[11px] text-white/60">{progressLine}</p>
      </div>

      {/* Payday chip strip — single scrolling line */}
      <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
        {occurrences.map((occ) => {
          const selected = selectedKey === occ.key
          const glow = glowKey === occ.key
          const filled = occ.status !== 'awaiting'
          const dot = OCC_STATUS_COLOR[occ.status]
          return (
            <button
              key={occ.key}
              type="button"
              onClick={onChipTap ? () => onChipTap(occ) : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                selected ? 'border-white/80 bg-white/10 text-white' : 'border-white/10 bg-white/[0.04] text-white/70'
              } ${glow ? 'income-await-glow' : ''}`}
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

      {/* Footer (tip / CTA) — parent-provided, fixed slot keeps height stable */}
      <div className="mt-auto pt-3">{footer}</div>
    </div>
  )
}
