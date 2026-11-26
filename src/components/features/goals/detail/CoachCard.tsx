'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { Button } from '@/components/ui/button'
import { useLocale, useT } from '@/lib/i18n'
import type { CoachView } from '@/lib/goals/goalDetail'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { formatWhole } from '@/lib/utils/formatters'

function CoachRow({ title, cta, onPress }: { title: string; cta: string; onPress: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <p className="min-w-0 flex-1 text-[0.9375rem] text-[var(--color-brand-text-primary)]">{title}</p>
      <Button size="touch" variant="outline" onClick={onPress} className="shrink-0 rounded-full bg-[var(--color-brand-elevated)]">
        {cta}
      </Button>
    </div>
  )
}

/** Behind-only card: what went missing and the two ways back. Deterministic, works offline. */
export function CoachCard({
  coach,
  targetDate,
  quarterly,
  yearly = false,
  onMove,
  onKeep,
}: {
  coach: CoachView
  targetDate: string
  quarterly: boolean
  /** A yearly plan: counted and worded in years. */
  yearly?: boolean
  onMove: () => void
  onKeep: () => void
}) {
  const t = useT().goals.detail
  const fq = useGoalsLtCopy().frequency
  const { locale } = useLocale()
  const month = (iso: string) =>
    new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
  const sinceLabel = new Date(`${coach.since.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short' })
  const money = (n: number) => formatWhole(Math.round(n))
  const title = yearly ? fq.coachTitleYears(coach.behindCount) : t.coachTitle(coach.behindCount, quarterly)
  const { moveDate } = coach.options

  return (
    <section aria-label={title} className="flex flex-col gap-2.5 rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3.5">
      <div>
        <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
        <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{t.coachShort(money(coach.shortfall), sinceLabel)}</p>
      </div>
      {moveDate ? <CoachRow title={t.moveTitle(month(moveDate.targetDate))} cta={t.moveCta} onPress={onMove} /> : null}
      <CoachRow title={t.keepTitle(month(targetDate))} cta={t.keepCta} onPress={onKeep} />
    </section>
  )
}
