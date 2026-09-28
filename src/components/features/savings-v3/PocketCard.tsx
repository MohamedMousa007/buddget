'use client'

import { Check, MoreVertical } from 'lucide-react'
import type { SavingsAccount } from '@/lib/store/types'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor, pocketIdentity } from '@/lib/savings/pocketIdentity'
import { rgba } from '@/lib/utils/color'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'

export interface PocketCardProps {
  account: SavingsAccount
  /** Portion of the balance reserved as emergency cover (blue segment). */
  coverAmount: number
  /** Portion committed to goals (pocket-colour segment). */
  goalsAmount: number
  /** Right-hand goal line: a goal name, "{top} + n more", "Emergency cover", or "No goal attached". */
  goalLabel: string
  /** Shows the Auto badge when the month-end remainder lands here. */
  isAuto: boolean
  onAdd?: () => void
  onWithdraw?: () => void
  onMenu?: (anchor: DOMRect) => void
  /** Read-only picker mode (§6.2): hides ⋮ + Add/Withdraw, shows a selection radio/check. */
  picker?: boolean
  selected?: boolean
  onSelect?: () => void
  /** Fills its carousel slide (RecurringIncomeCarousel) instead of the fixed 343px width. */
  fullWidth?: boolean
}

/** Width 343 per §3; the page carousel snaps these to centre. */
export const POCKET_CARD_WIDTH = 343

export function PocketCard({
  account, coverAmount, goalsAmount, goalLabel, isAuto, onAdd, onWithdraw, onMenu,
  picker, selected, onSelect, fullWidth,
}: PocketCardProps) {
  const color = pocketColor(account)
  const bal = account.currentBalance
  const cover = Math.max(0, Math.min(coverAmount, bal))
  const goals = Math.max(0, Math.min(goalsAmount, bal - cover))
  const free = Math.max(0, bal - cover - goals)
  const pct = (x: number) => (bal > 0 ? `${(x / bal) * 100}%` : '0%')

  const pickerWidth = 339
  return (
    <div
      className="relative overflow-hidden shrink-0"
      onClick={picker ? onSelect : undefined}
      style={{
        // Unified secondary-hero gradient — same tinted-glass surface as the debt/income cards
        // (heroCardStyle), keyed off the pocket's colour instead of a flat card fill.
        width: fullWidth ? '100%' : picker ? pickerWidth : POCKET_CARD_WIDTH, borderRadius: 16, padding: '15px 16px 14px',
        background: picker && !selected
          ? 'var(--color-brand-elevated)'
          : `linear-gradient(158deg, ${rgba(color, .16)}, rgba(255,255,255,.045) 55%), #0f0f15`,
        border: selected ? '1px solid rgba(55,195,104,.55)' : '1px solid rgba(255,255,255,.08)',
        boxShadow: selected ? '0 0 0 1px rgba(55,195,104,.2)' : 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.6)',
        scrollSnapAlign: picker ? 'start' : 'center',
        cursor: picker ? 'pointer' : undefined,
      }}
    >
      <div className="relative">
        <div className="flex items-start gap-3">
          <span
            className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, borderRadius: 12, background: rgba(color, .14), color }}
          >
            <SavingsAccountIcon account={account} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate" style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-brand-text-primary)' }}>
                {account.name}
              </span>
              {isAuto && (
                <span style={{ fontWeight: 700, fontSize: 8, letterSpacing: '.04em', color: '#EDC463', background: 'rgba(237,196,99,.16)', borderRadius: 5, padding: '2px 4px' }}>
                  AUTO
                </span>
              )}
            </div>
            <div className="truncate" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11.5, color: 'var(--color-brand-text-muted)', marginTop: 1 }}>
              {pocketIdentity(account)}
            </div>
          </div>
          {picker ? (
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                width: 26, height: 26, borderRadius: 999, marginTop: -2, marginRight: -2,
                background: selected ? '#37C368' : 'transparent',
                border: selected ? undefined : '1.5px solid var(--color-brand-border)',
              }}
            >
              {selected && <Check size={15} color="#fff" strokeWidth={3} />}
            </span>
          ) : (
            <IconButton
              onClick={(e) => onMenu?.(e.currentTarget.getBoundingClientRect())}
              aria-label="Pocket menu"
              style={{ width: 32, height: 32, marginTop: -4, marginRight: -6 }}
              className="shrink-0"
            >
              <MoreVertical size={18} />
            </IconButton>
          )}
        </div>

        <div className="mt-2.5 flex items-end gap-1.5">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 28, color: 'var(--color-brand-text-primary)', lineHeight: 1 }}>
            {fmtNum(bal)}
          </span>
          <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--color-brand-text-muted)', paddingBottom: 3 }}>{account.currency}</span>
        </div>

        {/* 3-segment bar: cover · goals · free */}
        <div className="mt-3 flex overflow-hidden" style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
          <div style={{ width: pct(cover), background: '#7EAEF9' }} />
          <div style={{ width: pct(goals), background: color }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, color: 'var(--color-brand-text-secondary)' }}>
            Free {fmtNum(free)}
          </span>
          <span className="truncate text-right" style={{ fontWeight: 500, fontSize: 11, color: 'var(--color-brand-text-muted)', maxWidth: '55%' }}>
            {goalLabel}
          </span>
        </div>

        {!picker && (
          <>
            <div className="my-3" style={{ height: 1, background: 'var(--color-brand-border)' }} />
            <div className="flex gap-2">
              <Button variant="success" size="touch" onClick={onAdd} className="flex-1">
                Add
              </Button>
              <Button size="touch" onClick={onWithdraw} className="flex-1">
                Withdraw
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
