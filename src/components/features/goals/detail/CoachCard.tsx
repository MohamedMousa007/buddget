'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { useLocale, useT } from '@/lib/i18n'
import type { CoachView } from '@/lib/goals/goalDetail'
import { formatCurrency } from '@/lib/utils/formatters'

function CoachRow({ title, sub, cta, variant, onPress }: { title: string; sub: string; cta: string; variant: 'default' | 'outline'; onPress: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
        <p className="text-xs text-[var(--color-brand-text-secondary)]">{sub}</p>
      </div>
      <Button size="touch" variant={variant} onClick={onPress} className="w-[104px] shrink-0">
        {cta}
      </Button>
    </div>
  )
}

/** Behind-only card: what went missing and the two ways back. Deterministic, works offline. */
export function CoachCard({
  coach,
  currency,
  targetDate,
  quarterly,
  onMove,
  onKeep,
}: {
  coach: CoachView
  currency: string
  targetDate: string
  quarterly: boolean
  onMove: () => void
  onKeep: () => void
}) {
  const t = useT().goals.detail
  const { locale } = useLocale()
  const month = (iso: string) =>
    new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  const sinceLabel = new Date(`${coach.since.slice(0, 7)}-01T00:00:00`).toLocaleDateString(locale, { month: 'long' })
  const money = (n: number) => formatCurrency(Math.round(n), currency, false)
  const { moveDate, keepDate } = coach.options

  return (
    <section
      className="flex flex-col gap-3 rounded-[20px] border border-[var(--color-brand-border)] p-3.5"
      style={{ background: 'color-mix(in srgb, var(--color-brand-amber) 10%, var(--color-brand-card))' }}
    >
      <div className="flex items-start gap-2.5">
        <BuddgyIcon size={24} mood="worried" />
        <div>
          <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.coachTitle(coach.behindCount, false)}</p>
          <p className="text-[13px] text-[var(--color-brand-text-secondary)]">{t.coachShort(money(coach.shortfall), sinceLabel)}</p>
        </div>
      </div>
      {moveDate ? (
        <CoachRow
          title={t.moveTitle(month(moveDate.targetDate))}
          sub={t.moveSub(money(moveDate.perPeriod), quarterly)}
          cta={t.moveCta}
          variant="default"
          onPress={onMove}
        />
      ) : null}
      <CoachRow
        title={t.keepTitle(month(targetDate))}
        sub={t.keepSub(money(keepDate.perPeriod), keepDate.sharePct, quarterly)}
        cta={t.keepCta}
        variant={moveDate ? 'outline' : 'default'}
        onPress={onKeep}
      />
    </section>
  )
}
