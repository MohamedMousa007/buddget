'use client'

import type { ReactNode } from 'react'
import { Check, Pencil } from 'lucide-react'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { heroCardStyle } from '@/components/features/income/incomeGlass'
import { PaydayTimeline } from '@/components/features/income/PaydayTimeline'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { IncomeSourceType } from '@/lib/store/types'

interface Props {
  sourceType?: IncomeSourceType
  name: string
  /** First sub-line: e.g. "Monthly · 5". Cadence only — payment goes on its own line. */
  cadenceLine: string
  /** Second sub-line: the payment method, abbreviated (glyph + label). */
  paymentLine?: ReactNode
  /** Big expected-this-month figure, already formatted (no currency). */
  expectedBig: string
  expectedCurrency: string
  /** i18n label under the big figure (e.g. "Expected / mo"). */
  expectedTag: string
  progressPct: number
  progressLine: ReactNode
  occurrences: IncomeOccurrence[]
  dateLabel: (occ: IncomeOccurrence) => string
  /** Compact per-payday amount shown when cadence leaves room (≤2 paydays). */
  amountLabel?: (occ: IncomeOccurrence) => string
  /** Payday key that shows the selection highlight (page: tapped; assign: default/selected). */
  selectedKey?: string | null
  /** Assign select mode: green tick top-right when this card is chosen (identical to the card carousel). */
  showTick?: boolean
  onChipTap?: (occ: IncomeOccurrence) => void
  /** When set, a pencil button (top-right) opens the source editor. */
  onEdit?: () => void
  editAriaLabel?: string
  footer: ReactNode
}

/**
 * Unified recurring-income hero card. Fixed 213px height regardless of cadence —
 * the payday timeline adapts to frequency (monthly: one full-width pill;
 * biweekly: two pills with amounts; weekly: a 4-dot timeline) without ever
 * reflowing or scrolling the card. Presentational: the parent owns selection +
 * footer.
 */
export function RecurringIncomeCard({
  sourceType,
  name,
  cadenceLine,
  paymentLine,
  expectedBig,
  expectedCurrency,
  expectedTag,
  progressPct,
  progressLine,
  occurrences,
  dateLabel,
  amountLabel,
  selectedKey,
  showTick,
  onChipTap,
  onEdit,
  editAriaLabel,
  footer,
}: Props) {
  const colors = incomeTypeColors(sourceType)
  const cornered = showTick || Boolean(onEdit)

  return (
    <div className="relative flex h-[213px] flex-col p-4 text-white" style={heroCardStyle(colors.fg)}>
      {showTick ? (
        <span className="absolute end-3 top-3 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#38D96B] text-white shadow-[0_2px_6px_rgba(0,0,0,.25)]">
          <Check className="h-[14px] w-[14px]" strokeWidth={3} />
        </span>
      ) : null}
      {!showTick && onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editAriaLabel}
          className="absolute end-1 top-1 flex h-11 w-11 items-center justify-center text-white/55 transition-colors hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
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
        <div className={`max-w-[38%] shrink-0 text-end ${cornered ? 'me-7 mt-1.5' : ''}`}>
          <p className="truncate font-mono-numbers text-base font-bold leading-none tracking-[-0.5px]">
            {expectedBig} <span className="text-[10px] font-medium text-white/55">{expectedCurrency}</span>
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/55">{expectedTag}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#35D46F] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
          />
        </div>
        <p className="mt-1.5 truncate font-mono-numbers text-[11px] text-white/70">{progressLine}</p>
      </div>

      {/* Payday timeline — never scrolls, so a drag starting here swipes the carousel.
          mb-2 is the structural gap between the paydays and the footer CTA. */}
      <div className="mb-2 mt-2.5">
        <PaydayTimeline
          occurrences={occurrences}
          dateLabel={dateLabel}
          amountLabel={amountLabel}
          selectedKey={selectedKey}
          onSelect={onChipTap}
        />
      </div>

      {/* Footer (tip / CTA) — fixed-height slot so tip↔CTA swap never reflows the card. */}
      <div className="mt-auto flex h-11 items-center">{footer}</div>
    </div>
  )
}
