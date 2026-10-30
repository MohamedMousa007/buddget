'use client'

import { useT } from '@/lib/i18n'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Check, MoreVertical, Pencil } from 'lucide-react'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { PaydayTimeline } from '@/components/features/income/PaydayTimeline'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { IncomeSourceType } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'

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
  /** Status suffix appended to the date label (e.g. " (Late!)"). */
  statusBracket?: (occ: IncomeOccurrence) => string
  /** Payday key that shows the selection highlight (page: tapped; assign: default/selected). */
  selectedKey?: string | null
  /** Assign select mode: green tick top-right when this card is chosen (identical to the card carousel). */
  showTick?: boolean
  onChipTap?: (occ: IncomeOccurrence) => void
  /** When set, tapping the card body selects it (assign flow); dots stop propagation. */
  onCardTap?: () => void
  /** When set, a pencil button (top-right) opens the source editor. */
  onEdit?: () => void
  /** Accessible name for the ⋮ menu trigger. Required whenever `onEdit` is passed —
   *  the trigger is icon-only, so without it a screen reader announces just "button". */
  editAriaLabel?: string
  footer: ReactNode
}

/**
 * Unified recurring-income hero card. Drawn through HeroBand (contained) —
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
  statusBracket,
  selectedKey,
  showTick,
  onChipTap,
  onCardTap,
  onEdit,
  editAriaLabel,
  footer,
}: Props) {
  const t = useT()
  const colors = incomeTypeColors(sourceType)
  const cornered = showTick || Boolean(onEdit)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)

  return (
    <div onClick={onCardTap} className={onCardTap ? 'cursor-pointer' : undefined}>
      <HeroBand
        contained
        label={name}
        aside={
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex size-[22px] items-center justify-center rounded-md" style={{ background: colors.bg, color: colors.fg }}>
              <IncomeTypeIcon type={sourceType} className="size-3.5" />
            </span>
            {showTick ? (
              <span className="flex size-[22px] items-center justify-center rounded-full bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            ) : null}
            {!showTick && onEdit ? (
              <>
                <IconButton
                  onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget.getBoundingClientRect()) }}
                  aria-label={editAriaLabel ?? t.common.edit}
                  className="-my-1 -me-2 text-[var(--flow-band-fg)]"
                >
                  <MoreVertical className="size-4" />
                </IconButton>
                <CardActionMenu
                  anchor={menuAnchor}
                  onClose={() => setMenuAnchor(null)}
                  items={[{ label: t.common.edit, icon: <Pencil size={17} />, onSelect: onEdit }]}
                />
              </>
            ) : null}
          </span>
        }
        numbers={
          <>
            <p className="min-w-0 truncate font-mono-numbers text-[28px] font-semibold leading-none tracking-[-0.03em]">
              {expectedBig} <span className={`text-xs font-medium ${BAND_FG2}`}>{expectedCurrency}</span>
            </p>
            <div className={`min-w-0 text-end text-[11px] leading-tight ${BAND_FG2}`}>
              <p className="truncate font-mono-numbers">{cadenceLine}</p>
              {paymentLine ? <div className="mt-0.5 flex items-center justify-end gap-1.5 truncate">{paymentLine}</div> : null}
            </div>
          </>
        }
        bar={
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: BAND_MIX }}>
              <div
                className="h-full rounded-full bg-[var(--color-brand-green)] transition-[width] duration-300"
                style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
              />
            </div>
            <BandScale>
              <span className="truncate">{progressLine}</span>
              <span className="shrink-0 uppercase">{expectedTag}</span>
            </BandScale>
          </>
        }
        extra={
          <>
            {/* Payday timeline never scrolls, so a drag starting here swipes the carousel. */}
            <div className="mt-2">
              <PaydayTimeline
                occurrences={occurrences}
                dateLabel={dateLabel}
                amountLabel={amountLabel}
                statusBracket={statusBracket}
                selectedKey={selectedKey}
                onSelect={onChipTap}
              />
            </div>
            <div className="flex h-11 items-center">{footer}</div>
          </>
        }
      />
    </div>
  )
}
