'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { useLocale, useT } from '@/lib/i18n'
import { USUAL_TICK, type PaceResult } from '@/lib/goals/goalPlan'
import { formatCurrency } from '@/lib/utils/formatters'

/** Buddgy's deterministic read on the pace for the chosen date. Offline-safe: no AI involved. */
export function CounselorCard({
  pace,
  usualKeep,
  frequency,
  currency,
  targetDate,
  onUseDate,
  onUseTarget,
}: {
  pace: PaceResult
  usualKeep: number | null
  frequency: 'monthly' | 'quarterly'
  currency: string
  targetDate: string
  onUseDate: (iso: string) => void
  onUseTarget: (amount: number) => void
}) {
  const t = useT().goals.flow.counselor
  const { locale } = useLocale()
  const month = (iso: string) =>
    new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  const money = (n: number) => formatCurrency(Math.round(n), currency, false)
  const stretch = pace.zone === 'stretch' || pace.zone === 'ambitious'
  const unknown = pace.zone === 'unknown'
  const keepPeriod = usualKeep === null ? null : usualKeep * (frequency === 'quarterly' ? 3 : 1)

  const title = unknown ? t.unknownTitle : stretch ? t.stretchTitle : t.comfortTitle
  const body = unknown
    ? t.unknownBody
    : stretch
      ? pace.altDate
        ? t.stretchBody(month(pace.altDate))
        : t.smallerTarget(money(pace.altTarget ?? 0))
      : t.comfortBody

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3.5" aria-live="polite">
      <div className="flex items-center gap-2">
        <BuddgyIcon size={24} />
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
        {!unknown ? (
          <span className="rounded-full bg-[var(--color-brand-card)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-text-primary)]">
            {stretch ? t.zoneStretch : t.zoneComfortable}
          </span>
        ) : null}
      </div>
      {!unknown ? (
        <div className="relative h-2.5 rounded-full bg-[var(--color-brand-card)]">
          <div
            className="h-full rounded-full bg-[var(--color-brand-primary-bright)] transition-[width] duration-[240ms] ease-out motion-reduce:transition-none"
            style={{ width: `${pace.fill}%` }}
          />
          <span className="absolute -top-0.5 h-3.5 w-0.5 bg-[var(--color-brand-text-primary)]" style={{ insetInlineStart: `${USUAL_TICK}%` }} aria-hidden />
        </div>
      ) : null}
      <div className="flex justify-between text-xs text-[var(--color-brand-text-secondary)]">
        <span>
          {t.paceAsked}: <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{money(pace.asked)}</b>
        </span>
        {keepPeriod !== null ? (
          <span>
            {t.usuallyKeep}: <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{money(keepPeriod)}</b>
          </span>
        ) : null}
      </div>
      <p className="text-[13px] leading-[1.45] text-[var(--color-brand-text-secondary)]">{body}</p>
      {stretch && (pace.altDate || pace.altTarget) ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="touch"
            onClick={() => (pace.altDate ? onUseDate(pace.altDate) : onUseTarget(pace.altTarget ?? 0))}
          >
            {pace.altDate ? t.useDate(month(pace.altDate)) : t.useTarget(money(pace.altTarget ?? 0))}
          </Button>
          <Button size="touch" variant="outline">
            {pace.altDate ? t.keepDate(month(targetDate)) : t.keepTarget}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
