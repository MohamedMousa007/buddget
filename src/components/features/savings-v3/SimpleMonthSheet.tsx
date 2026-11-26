'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { estimateEmergencyFund } from '@/lib/savings/estimateEmergencyFund'
import { SIMPLE_MONTH_DEFAULT_OFF, SIMPLE_MONTH_LINES, simpleMonthSum, type SimpleMonth, type SimpleMonthLine } from '@/lib/savings/simpleMonth'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

/** Category icon key and `--cat-*` tone for each line. */
const LOOK: Record<SimpleMonthLine, { cat: string; tone: string }> = {
  rent: { cat: 'rent', tone: 'rent' },
  food: { cat: 'food', tone: 'food' },
  transport: { cat: 'transport', tone: 'transport' },
  bills: { cat: 'bills', tone: 'utilities' },
  debtMinimums: { cat: 'debt', tone: 'rent' },
}

const parseFigure = (raw: string) => parseFloat(raw.replace(/,/g, '')) || 0

export interface SimpleMonthSheetProps {
  open: boolean
  onClose: () => void
  /** The derived simple month, base currency. */
  month: SimpleMonth
  currency: string
  /** The figure the user typed before (monthlyEssentials when it differs from the sum); '' for none. */
  initialOwn: string
  /** Replaces the debt-minimums source line ("Car loan 3,250 · valU 1,400"). */
  debtsLine?: string
  /** "Use this amount": the user's own figure when typed, else the sum of the counted lines. */
  onUse: (figure: number) => void
}

/** "A simple month": what still gets paid if money got tight, line by line, or the user's own figure. */
export function SimpleMonthSheet({ open, onClose, month, currency, initialOwn, debtsLine, onUse }: SimpleMonthSheetProps) {
  const ef = useT().wealthSheets.ef
  const c = useGoalsLtCopy().ef
  const [off, setOff] = useState<ReadonlySet<SimpleMonthLine>>(SIMPLE_MONTH_DEFAULT_OFF)
  const [own, setOwn] = useState(initialOwn)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lines = SIMPLE_MONTH_LINES.filter((k) => month[k] > 0)
  const sum = simpleMonthSum(month, off)
  const max = Math.max(1, ...lines.map((k) => month[k]))
  const ownValue = parseFigure(own)
  const figure = ownValue > 0 ? ownValue : sum

  const toggle = (k: SimpleMonthLine) => setOff((prev) => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    return next
  })

  const estimate = async () => {
    setBusy(true); setError(null); setNote(null)
    try {
      const est = await estimateEmergencyFund({ currency, trackedEssentials: sum })
      setOwn(String(est.monthlyEssentials))
      const text = est.rationale || ef.estimated(fmtNum(est.monthlyEssentials), currency)
      setNote(est.groundingLimited ? `${text} ${ef.groundingLimited}` : text)
    } catch (e) {
      setError(e instanceof Error ? e.message : ef.estimateFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title={c.simpleTitle}
      subtitle={c.simpleSub}
      zIndexClassName="z-[120]"
      overSheet
      footer={<Button size="cta-block" disabled={!(figure > 0)} onClick={() => { onUse(figure); onClose() }}>{c.use}</Button>}
    >
      <div className="native-scroll -mx-5 min-h-0 flex-1 space-y-3 overflow-y-auto px-5">
        <div className="flex flex-col items-center pb-2 pt-1 text-center">
          <p className="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">
            {fmtNum(sum)}
          </p>
          <p className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {ownValue > 0 ? c.ownUsed(fmtNum(ownValue)) : c.simpleHint}
          </p>
        </div>

        <Card padding="none" divide className="overflow-hidden" role="group" aria-label={c.simpleTitle}>
          {lines.map((k) => {
            const on = !off.has(k)
            const look = LOOK[k]
            return (
              <button
                key={k}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(k)}
                data-raw-button-ok="a toggle row of a grouped list: layout only, the tick shows the state"
                className={cn('flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-start', !on && 'opacity-55')}
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-[11px]"
                  style={{ background: `var(--cat-${look.tone}-bg)`, color: `var(--cat-${look.tone}-fg)` }}
                >
                  <CategoryIcon category={look.cat} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{ef[k]}</span>
                    <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{fmtNum(month[k])}</span>
                  </span>
                  <span className="mt-1 block h-1 rounded-full bg-[var(--color-brand-sunken)]">
                    <span
                      className={cn('block h-full rounded-full', on ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]')}
                      style={{ width: `${(month[k] / max) * 100}%` }}
                    />
                  </span>
                  <span dir="auto" className="mt-1 block truncate text-xs text-[var(--color-brand-text-muted)]">
                    {k === 'debtMinimums' && debtsLine ? debtsLine : c.sources[k]}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2',
                    on
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
                      : 'border-[var(--color-brand-border-strong)]',
                  )}
                >
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
              </button>
            )
          })}
        </Card>

        <div>
          <Card padding="none" className="overflow-hidden">
            <PickerRow
              label={c.ownLabel}
              value={
                <AmountTextInput
                  aria-label={c.ownLabel}
                  value={own}
                  onChange={setOwn}
                  currency={currency}
                  placeholder={c.ownPlaceholder}
                  className="min-h-11 w-full min-w-0 bg-transparent text-end font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-text-muted)]"
                />
              }
            />
          </Card>
          <p className="ms-1 mt-1.5 text-xs text-[var(--color-brand-text-muted)]">{ef.figureWins}</p>
        </div>

        <Button variant="ghost" size="cta-block" onClick={estimate} disabled={busy} className="text-[var(--color-brand-primary-ink)]">
          <Sparkles className={cn('size-4', busy && 'animate-pulse')} aria-hidden />
          {busy ? ef.estimating : c.estimate}
        </Button>
        {error ? <p role="alert" className="text-xs text-[var(--color-brand-red-text)]">{error}</p> : null}
        {note ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
      </div>
    </PickerSheet>
  )
}
