'use client'

import { useState, type ReactNode } from 'react'
import { SplitSavingsSheet } from '@/components/features/goals/SplitSavingsSheet'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { selectableCardVariants } from '@/components/ui/SelectableCard'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { periodMonths, sharesOverFull } from '@/lib/goals/goalPlan'
import type { GoalFrequency, GoalFundingMode } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

/** How a goal gets money: a share of each month's savings, a fixed amount every month / 3 months / year, or by hand. */
export interface FundPlan {
  mode: GoalFundingMode
  sharePct: number
  /** The fixed amount as typed, per period. */
  fixed: string
  /** Only a fixed amount has a period; a share and "by hand" are monthly. */
  frequency: GoalFrequency
}

const FREQS: GoalFrequency[] = ['monthly', 'quarterly', 'yearly']
const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0)

/** The row value for a plan: "20% of savings", "2,000 a month", "6,000 every 3 months", "I add it myself". */
export function useFundSummary() {
  const lt = useGoalsLtCopy()
  return (p: FundPlan, money: (n: number) => string) =>
    p.mode === 'manual' ? lt.goals.addItMyself
    : p.mode === 'fixed' ? lt.frequency.amountPer(money(num(p.fixed)), p.frequency)
    : lt.goals.shareOfSavings(p.sharePct)
}

function Radio({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-[var(--color-brand-primary)]' : 'border-[var(--color-brand-border-strong)]')}>
      {on ? <span className="size-2.5 rounded-full bg-[var(--color-brand-primary)]" /> : null}
    </span>
  )
}

/** One of the three ways: a radio header, and its own controls under it once chosen (outside the button). */
function FundCard({ on, title, sub, trailing, onPick, children }: { on: boolean; title: string; sub: string; trailing?: ReactNode; onPick: () => void; children?: ReactNode }) {
  return (
    <div className={cn(selectableCardVariants({ layout: 'stack', selected: on, surface: 'card' }), 'gap-0 p-0')}>
      <button type="button" role="radio" aria-checked={on} onClick={onPick} className="flex w-full items-center gap-3 px-4 py-3.5 text-start">
        <Radio on={on} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
          <span className="block text-xs text-[var(--color-brand-text-secondary)]">{sub}</span>
        </span>
        {trailing}
      </button>
      {on && children ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  )
}

/**
 * "Fund it": the three ways a goal gets money, one sheet shared by Add goal and the goal sheet's "Each month" row.
 * Edits are live (`onChange`); Done closes. `children` adds blocks under the cards (money already saved, the pocket note).
 */
export function FundItSheet({ open, onClose, onDone, name, currency, value, onChange, usualKeep, otherShare, children }: {
  open: boolean
  onClose: () => void
  /** Done, when it does more than close (the goal sheet saves the plan); defaults to `onClose`. */
  onDone?: () => void
  name: string
  currency: string
  value: FundPlan
  onChange: (next: FundPlan) => void
  /** What the user keeps a month, in the goal's currency; null when not known yet. */
  usualKeep: number | null
  /** Share already promised to the user's other goals. */
  otherShare: number
  children?: ReactNode
}) {
  const lt = useGoalsLtCopy()
  const c = lt.goals
  const f = lt.frequency
  const set = (patch: Partial<FundPlan>) => onChange({ ...value, ...patch })
  const share = value.mode === 'share'
  const perShare = usualKeep ? Math.round((usualKeep * value.sharePct) / 100) : null
  const fixedPerMonth = num(value.fixed) / periodMonths(value.frequency)
  const [split, setSplit] = useState(false)
  const overFull = share && sharesOverFull(otherShare, value.sharePct)

  return (
    <>
    <PickerSheet
      open={open}
      onClose={onClose}
      title={c.fundIt}
      subtitle={c.fundSub(name)}
      zIndexClassName="z-[120]"
      footer={<Button size="cta-block" onClick={onDone ?? onClose} disabled={overFull}>{c.done}</Button>}
    >
      <div className="native-scroll -mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1">
        <div role="radiogroup" aria-label={c.fundIt} className="flex flex-col gap-2">
          <FundCard
            on={share}
            title={c.shareTitle}
            sub={c.shareSub}
            onPick={() => set({ mode: 'share', frequency: 'monthly' })}
            trailing={
              <span className={cn('font-mono-numbers text-[1.375rem] font-semibold tracking-[-0.03em]', share ? 'text-[var(--color-brand-primary-ink)]' : 'text-[var(--color-brand-text-muted)]')}>
                {value.sharePct}%
              </span>
            }
          >
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={value.sharePct}
              onChange={(e) => set({ sharePct: Number(e.target.value) })}
              aria-label={c.shareAria}
              aria-valuetext={`${value.sharePct}%`}
              className="h-11 w-full accent-[var(--color-brand-primary)]"
            />
            <div className="flex justify-between font-mono-numbers text-[0.6875rem] text-[var(--color-brand-text-muted)]" dir="ltr">
              <span>5%</span><span>50%</span><span>100%</span>
            </div>
            {usualKeep ? (
              <>
                <p className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.shareOf(formatWhole(usualKeep))}</p>
                <p className="mt-0.5 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.shareResult(formatWhole(perShare ?? 0))}</p>
              </>
            ) : (
              <p className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.shareUnknown}</p>
            )}
            <p
              role={overFull ? 'alert' : undefined}
              className={cn('mt-1 text-xs', overFull ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-muted)]')}
            >
              {overFull ? c.shareOver(otherShare + value.sharePct) : c.shareTaken(otherShare + value.sharePct)}
            </p>
            {otherShare > 0 ? (
              <OptionChip size="sm" onClick={() => setSplit(true)} className="mt-2 w-fit font-mono-numbers">
                {otherShare + value.sharePct}%
              </OptionChip>
            ) : null}
          </FundCard>

          <FundCard
            on={value.mode === 'fixed'}
            title={c.fixedTitle}
            sub={c.fixedSub}
            onPick={() => set({ mode: 'fixed' })}
            trailing={value.mode === 'fixed' || !num(value.fixed) ? undefined : (
              <span className="font-mono-numbers text-[0.9375rem] text-[var(--color-brand-text-muted)]">{formatWhole(num(value.fixed))}</span>
            )}
          >
            {/* The unit inline after the amount (the grey code, as everywhere in Light touch), not a sign before it. */}
            <label dir="ltr" className="flex h-12 items-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-brand-focus)]">
              <AmountField bare value={value.fixed} onChange={(v) => set({ fixed: v })} decimalsFor={currency} aria-label={c.fixedAria}
                className="flex min-w-0 flex-1 items-center font-mono-numbers text-base text-[var(--color-brand-text-primary)]" />
              <span className="shrink-0 font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-muted)]">{currency}</span>
            </label>
            <p className="mt-3 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{f.howOften}</p>
            <div className="mt-1.5 flex gap-2">
              {FREQS.map((k) => (
                <OptionChip key={k} size="segment" selected={value.frequency === k} onClick={() => set({ frequency: k })} className="flex-1 justify-center">
                  {f.every[k]}
                </OptionChip>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">
              {value.frequency === 'monthly' ? f.checkedMonthly : f.checkedOnDue(formatWhole(fixedPerMonth))}
            </p>
          </FundCard>

          <FundCard on={value.mode === 'manual'} title={c.manualTitle} sub={c.manualSub} onPick={() => set({ mode: 'manual', frequency: 'monthly' })} />
        </div>
        {children}
      </div>
    </PickerSheet>
    {split ? <SplitSavingsSheet onClose={() => setSplit(false)} /> : null}
    </>
  )
}
