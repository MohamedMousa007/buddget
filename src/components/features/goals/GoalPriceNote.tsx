'use client'

import { TriangleAlert } from 'lucide-react'
import { useLocale } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import type { GoalProgressDetail } from '@/lib/goals/computeGoalProgress'
import { formatWhole } from '@/lib/utils/formatters'

/**
 * The missing-price warning of the v9 Goals page (§4.5): a gold part counted at its last price shows that price and
 * its date; a part with no price at all (gold, or another unit) says it counts once prices load. `line` sits on the
 * goal card, `notice` in the goal sheet. Renders nothing when every part is priced live, or on an achieved goal (final,
 * its progress no longer matters).
 */
export function GoalPriceNote({ stalePrice, priceMissing, achieved = false, look }: Pick<GoalProgressDetail, 'stalePrice' | 'priceMissing'> & { achieved?: boolean; look: 'line' | 'notice' }) {
  const c = useGoalsLtCopy().goals
  const { locale } = useLocale()
  if (achieved || (!stalePrice && !priceMissing)) return null
  const date = stalePrice ? new Date(stalePrice.at).toLocaleDateString(intlTag(locale), { month: 'short', day: 'numeric' }) : ''
  const perGram = stalePrice ? formatWhole(stalePrice.perGram) : ''
  const missing = priceMissing === 'gold' ? c.goldMissing : c.priceMissing
  if (look === 'line') {
    return (
      <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand-amber)]">
        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0">{stalePrice ? c.goldStale(perGram, date) : missing}</span>
      </span>
    )
  }
  return (
    <div role="status" className="flex gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-amber)]" />
      <span className="min-w-0 flex-1 text-[0.8125rem] text-[var(--color-brand-text-primary)]">
        <b className="block font-semibold">{stalePrice || priceMissing === 'gold' ? c.goldStaleTitle : c.priceMissingTitle}</b>
        <span className="text-[var(--color-brand-text-secondary)]">{stalePrice ? c.goldStaleBody(perGram, date) : missing}</span>
      </span>
    </div>
  )
}
