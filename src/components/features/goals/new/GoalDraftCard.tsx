'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { Check, Flag } from 'lucide-react'
import { CheckpointBar } from '@/components/features/goals/CheckpointBar'
import { useLocale, useT } from '@/lib/i18n'
import type { PaceResult } from '@/lib/goals/goalPlan'
import { goalVisual } from '@/lib/goals/goalVisual'
import type { GoalCategory } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

/** The goal as it will look on the Goals page, shaped live while Buddgy and the user talk it through. */
export function GoalDraftCard({
  category, name, target, saved, currency, targetDate, pace, quarterly,
}: {
  category: GoalCategory
  name: string
  target: number
  saved: number
  currency: string
  targetDate: string | null
  pace: PaceResult | null
  quarterly: boolean
}) {
  const t = useT().goals.flow
  const { locale } = useLocale()
  const { icon: Icon, cat } = goalVisual(category)
  const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0
  const due = targetDate
    ? new Date(`${targetDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
    : t.chat.dateMissing
  const ready = target > 0 && pace !== null
  const stretch = pace?.zone === 'stretch' || pace?.zone === 'ambitious'
  const StatusIcon = ready && !stretch ? Check : Flag
  const money = (n: number) => formatCurrency(Math.round(n), currency, false)

  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 pt-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
          style={{ color: `var(--color-cat-${cat})`, background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))` }}
          aria-hidden
        >
          <Icon className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-[1.15] text-[var(--color-brand-text-primary)]">{name}</p>
          <p className="mt-0.5 truncate font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{due}</p>
        </div>
        <span className="font-mono-numbers text-xl font-semibold text-[var(--color-brand-text-primary)]">{percent}%</span>
      </div>
      <p className="flex h-6 items-baseline gap-1.5 font-mono-numbers leading-6">
        <span className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{money(saved)}</span>
        <span className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
          {target > 0 ? t.chat.ofTarget(money(target)) : t.chat.amountMissing}
        </span>
      </p>
      <CheckpointBar percent={percent} />
      <div className="-mx-4 flex h-12 items-center gap-2 border-t border-[var(--color-brand-border)] px-4">
        <StatusIcon className={`size-4 shrink-0 ${stretch ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-primary-ink)]'}`} aria-hidden />
        <span className="truncate text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]">
          {ready && pace ? `${t.chat.paceLine(money(pace.asked), quarterly)} · ${stretch ? t.counselor.zoneStretch : t.counselor.zoneComfortable}` : t.chat.amountMissing}
        </span>
      </div>
    </div>
  )
}
